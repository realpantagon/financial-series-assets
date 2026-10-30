"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { fetchAllFCDEntries, addFCDEntry, calculateFCDStats, formatCurrency } from "../api/fcd"
import type { FCDEntry, FCDStats, NewFCDEntry, FCDTxType } from "../api/fcd/types"
import { format, parseISO, parse } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BottomSheet, Chips, Field, Group, Money, PrimaryButton, SectionLabel, Segmented, fieldClass } from "@/components/ios"
import { cn } from "@/lib/utils"
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Coins, Inbox, Percent, Plus, RefreshCw, ScanLine, type LucideIcon } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface ExtractedFields {
  THB: number | null
  USD: number | null
  Rate: number | null
  Date: string | null
}

function parseExtractedDate(dateStr: string | null): string {
  // Return format compatible with datetime-local (yyyy-MM-ddThh:mm)
  if (!dateStr) return format(new Date(), "yyyy-MM-dd'T'HH:mm")

  try {
    // Attempt cleaning typical OCR artifacts
    const cleanDate = dateStr.replace(/Submission Date/i, "").trim()
    // Try parsing with time first
    const parsedWithTime = parse(cleanDate, "d MMMM yyyy - h:mm a", new Date())
    if (!isNaN(parsedWithTime.getTime())) {
      return format(parsedWithTime, "yyyy-MM-dd'T'HH:mm")
    }

    // Fallback to date only (default to current time or 00:00? User requested User Local time default if not specified, 
    // but if OCR found a date only, typically it implies 00:00 or current time. 
    // Let's use current time for the time part if missing, or 00:00 if that's safer. 
    // The prompt says "If user doesn't select time -> set to current time". 
    // For OCR, probably safer to keep current time?
    const cleanDateOnly = dateStr.split("-")[0].trim()
    const parsedDate = parse(cleanDateOnly, "d MMMM yyyy", new Date())

    // Merge parsed date with current time
    const now = new Date()
    parsedDate.setHours(now.getHours(), now.getMinutes())

    return format(parsedDate, "yyyy-MM-dd'T'HH:mm")
  } catch {
    return format(new Date(), "yyyy-MM-dd'T'HH:mm")
  }
}

const PAGE = 30

export default function FCDDashboard() {
  const [entries, setEntries] = useState<FCDEntry[]>([])
  const [stats, setStats] = useState<FCDStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal + OCR
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [modalFields, setModalFields] = useState<ExtractedFields | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)

  // UI State
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [filter, setFilter] = useState<"ALL" | "FX" | "GOLD" | "INTEREST" | "TRANSFER">("ALL")
  const [saving, setSaving] = useState(false)

  // Entry form
  const [entryData, setEntryData] = useState<NewFCDEntry>({
    tx_type: "FX",
    status: "IN",
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    usd: 0,
    thb: null,
    rate: null,
    note: "",
  })

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchAllFCDEntries()
      setEntries(data)
      const calculatedStats = calculateFCDStats(data)
      setStats(calculatedStats)
    } catch (error) {
      console.error("Error fetching FCD data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])


  const rateChartData = entries
    .filter((e) => e.rate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry) => ({
      date: format(parseISO(entry.date), "dd/MM"),
      rate: Number(entry.rate || 0),
    }))

  const handleTxTypeChange = (newType: FCDTxType) => {
    let newStatus = entryData.status
    let newThb = entryData.thb
    let newRate = entryData.rate

    switch (newType) {
      case "FX":
        newStatus = "IN"
        // Ensure THB/Rate are numeric if switching to FX, or keep them if they are valid
        newThb = typeof newThb === 'number' ? newThb : 0
        newRate = typeof newRate === 'number' ? newRate : 0
        break
      case "GOLD_BUY":
        newStatus = "OUT"
        newThb = null
        newRate = null
        break
      case "GOLD_SELL":
        newStatus = "IN"
        newThb = null
        newRate = null
        break
      case "INTEREST":
        newStatus = "Interest"
        newThb = null
        newRate = null
        break
      case "TRANSFER":
        if (newStatus !== "IN" && newStatus !== "OUT") newStatus = "IN"
        newThb = null
        newRate = null
        break
    }
    setEntryData({ ...entryData, tx_type: newType, status: newStatus, thb: newThb, rate: newRate })
  }

  const handleAddEntry = async () => {
    // Validation: FX requires rate & thb
    if (entryData.tx_type === "FX") {
      if ((entryData.rate ?? 0) <= 0 || (entryData.thb ?? 0) <= 0) {
        toast.error("FX needs both THB amount and rate")
        return
      }
    } else {
      // Validation: Non-FX must have null thb/rate
      if (entryData.thb != null && entryData.thb !== 0) {
        toast.error(`${entryData.tx_type} entries cannot have a THB amount`)
        return
      }
      if (entryData.rate != null && entryData.rate !== 0) {
        toast.error(`${entryData.tx_type} entries cannot have a rate`)
        return
      }
    }

    if (entryData.usd <= 0) {
      toast.error("Enter a USD amount")
      return
    }

    // Strict payload construction
    // Convert local datetime-local string to ISO 8601 with timezone offset
    // The input value is like "2026-02-03T15:30" (local time)
    // We want to send "2026-02-03T15:30:00+07:00"
    const dateObj = new Date(entryData.date)
    // date-fns format(date, "yyyy-MM-dd'T'HH:mm:ssXXX") will output the local time with offset
    // IMPORTANT: new Date("2026-02-03T15:30") creates a date in local timezone.
    const isoWithOffset = format(dateObj, "yyyy-MM-dd'T'HH:mm:ssXXX")

    const payload: NewFCDEntry = {
      ...entryData,
      date: isoWithOffset,
      // Force nulls for non-FX types to ensure no 0s are sent
      thb: entryData.tx_type === 'FX' ? entryData.thb : null,
      rate: entryData.tx_type === 'FX' ? entryData.rate : null,
    }

    try {
      setSaving(true)
      await addFCDEntry(payload)
      setEntryData({
        tx_type: "FX",
        status: "IN",
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        usd: 0,
        thb: 0, // Reset to 0 for FX default
        rate: 0, // Reset to 0 for FX default
        note: "",
      })
      fetchData()
      setShowAddEntry(false)
      toast.success("Entry saved")
    } catch (error) {
      console.error("Error adding FCD entry:", error)
      toast.error("Could not save entry")
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setImage(event.target?.result as string)
        setModalFields(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const extractText = async () => {
    if (!image) return

    setOcrLoading(true)
    setOcrProgress(0)

    try {
      setOcrProgress(20)

      const mimeType = image.split(",")[0].split(":")[1].split(";")[0]
      const blob = await fetch(image).then((r) => r.blob())
      const imageFile = new File([blob], "fcd-slip.jpg", { type: mimeType })

      const formData = new FormData()
      formData.append("file", imageFile)
      formData.append("model", "typhoon-ocr")
      formData.append("task_type", "default")
      formData.append("max_tokens", "16384")
      formData.append("temperature", "0.1")
      formData.append("top_p", "0.6")
      formData.append("repetition_penalty", "1.2")

      setOcrProgress(40)

      const typhoonResponse = await fetch("/api/ocr", { method: "POST", body: formData })

      setOcrProgress(60)

      if (!typhoonResponse.ok) {
        const errorText = await typhoonResponse.text()
        let message = errorText
        try { message = JSON.parse(errorText).error?.message ?? errorText } catch { /* plain text */ }
        throw new Error(message)
      }

      const typhoonResult = await typhoonResponse.json()

      setOcrProgress(80)

      let fields: ExtractedFields | null = null

      for (const pageResult of typhoonResult.results || []) {
        if (pageResult.success && pageResult.message) {
          const content = pageResult.message.choices[0].message.content

          const thbMatch =
            content.match(/Exchange from\s+([0-9,]+\.?\d*)\s*THB/i) || content.match(/([0-9,]+\.?\d+)\s*THB/i)
          const usdMatch = content.match(/To\s+([0-9,]+\.?\d*)\s*USD/i) || content.match(/([0-9,]+\.?\d+)\s*USD/i)
          const rateMatch = content.match(/1\s*USD\s*=\s*([0-9.,]+)\s*THB/i)

          const dateMatch =
            content.match(/Submission Date.*?(\d{1,2}\s+\w+\s+\d{4}(?:\s*-\s*\d{1,2}:\d{2}\s*[AP]M)?)/i) ||
            content.match(/(\d{1,2}\s+\w+\s+\d{4}(?:\s*-\s*\d{1,2}:\d{2}\s*[AP]M)?)/i)

          if (thbMatch || usdMatch || rateMatch) {
            fields = {
              THB: thbMatch ? Number.parseFloat(thbMatch[1].replace(/,/g, "")) : null,
              USD: usdMatch ? Number.parseFloat(usdMatch[1].replace(/,/g, "")) : null,
              Rate: rateMatch ? Number.parseFloat(rateMatch[1].replace(/,/g, "")) : null,
              Date: dateMatch ? dateMatch[1] : null,
            }
            break
          }
        } else if (!pageResult.success) {
          throw new Error(`OCR processing failed: ${pageResult.error || "Unknown error"}`)
        }
      }

      if (!fields) {
        throw new Error("Could not extract structured data from OCR result")
      }

      setModalFields(fields)
      setOcrProgress(100)
    } catch (error) {
      console.error("OCR Error:", error)
      toast.error("Could not read the slip", { description: error instanceof Error ? error.message : "Please try again." })
    } finally {
      setOcrLoading(false)
      setOcrProgress(0)
    }
  }

  const resetOCR = () => {
    setImage(null)
    setModalFields(null)
    setShowUploadModal(false)
  }

  const fillFromModal = () => {
    if (!modalFields) return

    setEntryData({
      tx_type: "FX",
      status: "IN",
      date: parseExtractedDate(modalFields.Date),
      usd: modalFields.USD || 0,
      thb: modalFields.THB || 0,
      rate: modalFields.Rate || 0,
      note: "Auto-filled from Typhoon OCR",
    })

    setShowUploadModal(false)
    setShowAddEntry(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
      </div>
    )
  }

  const cash = stats?.cash_remain ?? 0
  const netFlow = stats && stats.total_in > 0 ? (cash / stats.total_in) * 100 : 0
  const gold = stats?.gold_profit ?? 0

  const filtered = entries
    .filter((e) => {
      if (filter === "ALL") return true
      if (filter === "GOLD") return e.tx_type === "GOLD_BUY" || e.tx_type === "GOLD_SELL"
      if (filter === "INTEREST") return e.tx_type === "INTEREST" || e.status === "Interest"
      return e.tx_type === filter
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const visible = filtered.slice(0, shown)

  return (
    <div className="flex flex-col gap-4">
      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setShowAddEntry(true)}>
          <Plus data-icon="inline-start" />
          Add entry
        </Button>
        <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
          <ScanLine data-icon="inline-start" />
          Upload slip
        </Button>
      </div>

      {/* Cash */}
      <section className="rounded-3xl bg-card px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">Cash remaining</p>
          <Badge variant={cash >= 0 ? "success" : "destructive"}>
            {cash >= 0 ? "+" : ""}{netFlow.toFixed(1)}% of inflow
          </Badge>
        </div>
        <Money value={cash} symbol="$" className={cn("mt-2", cash < 0 && "text-rose-500")} />
        <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-2 gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <ArrowDownLeft className="size-4 text-emerald-500" /> Total in
            </p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums text-emerald-500">{formatCurrency(stats?.total_in ?? 0, "USD")}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <ArrowUpRight className="size-4 text-rose-500" /> Total out
            </p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums text-rose-500">{formatCurrency(stats?.total_out ?? 0, "USD")}</p>
          </div>
        </div>
      </section>

      {/* Performance */}
      <div>
        <SectionLabel>Performance</SectionLabel>
        <Group>
          <StatRow label="Gold profit" value={`${gold > 0 ? "+" : ""}${formatCurrency(gold, "USD")}`} tone={gold < 0 ? "text-rose-500" : "text-foreground"} />
          <StatRow label="Interest income" value={`+${formatCurrency(stats?.interest_income ?? 0, "USD")}`} tone="text-emerald-500" />
          <StatRow label="Average rate" value={`${(stats?.weighted_avg_rate ?? 0).toFixed(4)} THB/USD`} />
        </Group>
      </div>

      {/* Rate chart */}
      {rateChartData.length > 0 && (
        <div>
          <SectionLabel>Exchange rate</SectionLabel>
          <div className="rounded-2xl bg-card pt-4 pr-3 pb-2 pl-1">
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="oklch(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={32}
                  />
                  <YAxis
                    width={44}
                    tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(value: number) => value.toFixed(1)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(var(--popover))", border: "none", borderRadius: 12, color: "oklch(var(--foreground))" }}
                    itemStyle={{ color: "oklch(var(--foreground))" }}
                    labelStyle={{ color: "oklch(var(--muted-foreground))", fontSize: 12 }}
                    formatter={(value) => [value ? Number(value).toFixed(4) : "0.0000", "Rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="oklch(var(--brand))"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 5, strokeWidth: 0, fill: "oklch(var(--brand))" }}
                    name="Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="flex flex-col gap-3">
        <SectionLabel right={<span className="text-[13px] text-muted-foreground">{filtered.length} records</span>}>
          Transactions
        </SectionLabel>
        <Chips
          className="-mt-3"
          value={filter}
          onChange={(v) => { setFilter(v); setShown(PAGE) }}
          options={[
            { value: "ALL", label: "All" },
            { value: "FX", label: "FX" },
            { value: "GOLD", label: "Gold" },
            { value: "INTEREST", label: "Interest" },
            { value: "TRANSFER", label: "Transfer" },
          ]}
        />

        {filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
              <EmptyTitle>No transactions</EmptyTitle>
              <EmptyDescription>{entries.length === 0 ? "Add your first entry to start the ledger." : "Nothing matches this filter."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Group>{visible.map((entry) => <EntryRow key={entry.id} entry={entry} />)}</Group>
        )}

        {visible.length < filtered.length && (
          <Button variant="secondary" className="w-full h-12" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({filtered.length - visible.length} left)
          </Button>
        )}
      </div>

      {/* Add entry */}
      <BottomSheet open={showAddEntry} onOpenChange={setShowAddEntry} title="Add entry">
        <div className="flex flex-col gap-4 pb-2">
          <Segmented
            value={entryData.tx_type as "FX" | "INTEREST" | "TRANSFER"}
            onChange={(v) => handleTxTypeChange(v)}
            options={[
              { value: "FX", label: "FX" },
              { value: "INTEREST", label: "Interest" },
              { value: "TRANSFER", label: "Transfer" },
            ]}
          />

          {entryData.tx_type === "TRANSFER" && (
            <Segmented
              value={entryData.status === "OUT" ? "OUT" : "IN"}
              onChange={(v) => setEntryData({ ...entryData, status: v })}
              options={[{ value: "IN", label: "Money in", tone: "in" }, { value: "OUT", label: "Money out", tone: "out" }]}
            />
          )}

          <Field label="USD amount">
            <input
              type="number" inputMode="decimal" step="0.01" placeholder="0.00"
              value={entryData.usd || ""}
              onChange={(e) => setEntryData({ ...entryData, usd: Number.parseFloat(e.target.value) || 0 })}
              className={cn(fieldClass, "h-14 text-[24px] font-semibold tabular-nums")}
            />
          </Field>

          {entryData.tx_type === "FX" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="THB amount">
                <input
                  type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                  value={entryData.thb || ""}
                  onChange={(e) => setEntryData({ ...entryData, thb: Number.parseFloat(e.target.value) || 0 })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Rate">
                <input
                  type="number" inputMode="decimal" step="0.0001" placeholder="0.0000"
                  value={entryData.rate || ""}
                  onChange={(e) => setEntryData({ ...entryData, rate: Number.parseFloat(e.target.value) || 0 })}
                  className={fieldClass}
                />
              </Field>
            </div>
          )}

          <Field label="Date & time">
            <input
              type="datetime-local" value={entryData.date}
              onChange={(e) => setEntryData({ ...entryData, date: e.target.value })}
              className={fieldClass}
            />
          </Field>

          <Field label="Note (optional)">
            <input
              type="text" value={entryData.note || ""} placeholder="Add details"
              onChange={(e) => setEntryData({ ...entryData, note: e.target.value })}
              className={fieldClass}
            />
          </Field>

          <PrimaryButton onClick={handleAddEntry} loading={saving}>
            Save {entryData.tx_type === "FX" ? "FX exchange" : entryData.tx_type === "INTEREST" ? "interest" : "transfer"}
          </PrimaryButton>
        </div>
      </BottomSheet>

      {/* Upload slip */}
      <BottomSheet open={showUploadModal} onOpenChange={(o) => { if (!o) resetOCR() }} title="Upload slip">
        <div className="flex flex-col gap-4 pb-2">
          <input type="file" accept="image/*" onChange={handleImageUpload} className="field" />

          {image && (
            <div className="w-full rounded-2xl overflow-hidden">
              <img src={image} alt="Uploaded slip" className="w-full h-auto" />
            </div>
          )}

          <PrimaryButton onClick={extractText} disabled={!image} loading={ocrLoading}>
            {ocrLoading ? `Extracting… ${ocrProgress}%` : "Extract text"}
          </PrimaryButton>

          {modalFields && (
            <div className="flex flex-col gap-4 pt-4 border-t border-border/60">
              <Alert>
                <AlertDescription>Review the values, then fill the entry form.</AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-3">
                <Field label="USD">
                  <input type="number" inputMode="decimal" step="0.01" value={modalFields.USD ?? ""}
                    onChange={(e) => setModalFields({ ...modalFields, USD: Number.parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </Field>
                <Field label="THB">
                  <input type="number" inputMode="decimal" step="0.01" value={modalFields.THB ?? ""}
                    onChange={(e) => setModalFields({ ...modalFields, THB: Number.parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </Field>
                <Field label="Rate">
                  <input type="number" inputMode="decimal" step="0.0001" value={modalFields.Rate ?? ""}
                    onChange={(e) => setModalFields({ ...modalFields, Rate: Number.parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </Field>
                <Field label="Date">
                  <input type="text" value={modalFields.Date ?? ""} placeholder="22 Dec 2025 - 12:30 AM"
                    onChange={(e) => setModalFields({ ...modalFields, Date: e.target.value })} className={fieldClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" className="h-12" onClick={resetOCR}>Clear</Button>
                <Button className="h-12" onClick={fillFromModal}>Fill entry</Button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function StatRow({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 min-h-[52px]">
      <span className="text-[17px]">{label}</span>
      <span className={cn("text-[17px] font-semibold tabular-nums", tone)}>{value}</span>
    </div>
  )
}

const TYPE_META: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
  FX: { label: "FX exchange", icon: RefreshCw, tint: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  GOLD_BUY: { label: "Gold buy", icon: Coins, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  GOLD_SELL: { label: "Gold sell", icon: Coins, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  INTEREST: { label: "Interest", icon: Percent, tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  TRANSFER: { label: "Transfer", icon: ArrowLeftRight, tint: "bg-primary/15 text-primary" },
}

function EntryRow({ entry }: { entry: FCDEntry }) {
  const key = entry.tx_type === "INTEREST" || entry.status === "Interest" ? "INTEREST" : entry.tx_type
  const meta = TYPE_META[key] ?? TYPE_META.TRANSFER
  const Icon = meta.icon
  const isIn = entry.status === "IN" || entry.status === "Interest"
  const sub = [
    format(parseISO(entry.date), "d MMM yyyy, HH:mm"),
    entry.rate ? `@${Number(entry.rate).toFixed(4)}` : null,
    entry.origin === "dime" && entry.symbol ? `${entry.symbol} · ${Number(entry.qty ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${entry.qty_unit ?? ""}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[68px]">
      <span className={cn("size-10 shrink-0 rounded-full flex items-center justify-center", meta.tint)}>
        <Icon className="size-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-medium leading-snug">{meta.label}</p>
        <p className="text-[13px] text-muted-foreground tabular-nums">{sub}</p>
        {entry.note && <p className="text-[13px] text-muted-foreground truncate">{entry.note}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-[17px] font-semibold tabular-nums", isIn ? "text-emerald-500" : "text-foreground")}>
          {isIn ? "+" : "-"}{formatCurrency(entry.usd, "USD")}
        </p>
        {entry.thb ? <p className="text-[13px] text-muted-foreground tabular-nums">{formatCurrency(entry.thb, "THB")}</p> : null}
      </div>
    </div>
  )
}

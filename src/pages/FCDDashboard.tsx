"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { fetchFCDEntries, addFCDEntry, calculateFCDStats, formatCurrency } from "../api/fcd"
import type { FCDEntry, FCDStats, NewFCDEntry, FCDTxType } from "../api/fcd/types"
import { format, parseISO, parse } from "date-fns"
import Input from "../components/fcd/Input"
import Button from "../components/fcd/Button"
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
  const [currentPage, setCurrentPage] = useState(1)

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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const data = await fetchFCDEntries()
      setEntries(data)
      const calculatedStats = calculateFCDStats(data)
      setStats(calculatedStats)
    } catch (error) {
      console.error("Error fetching FCD data:", error)
    } finally {
      setLoading(false)
    }
  }


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
        alert("For FX, Rate and THB are required")
        return
      }
    } else {
      // Validation: Non-FX must have null thb/rate
      if (entryData.thb != null && entryData.thb !== 0) {
        alert(`For ${entryData.tx_type}, THB must be empty (null).`)
        return
      }
      if (entryData.rate != null && entryData.rate !== 0) {
        alert(`For ${entryData.tx_type}, Rate must be empty (null).`)
        return
      }
    }

    if (entryData.usd <= 0) {
      alert("Please enter USD amount")
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
    } catch (error) {
      console.error("Error adding FCD entry:", error)
      alert("Failed to add entry")
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
      const typhoonApiKey = import.meta.env.VITE_TYPHOON_API_KEY

      if (!typhoonApiKey) {
        throw new Error("Typhoon API key not found in environment variables")
      }

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

      const typhoonResponse = await fetch("https://api.opentyphoon.ai/v1/ocr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${typhoonApiKey}`,
        },
        body: formData,
      })

      setOcrProgress(60)

      if (!typhoonResponse.ok) {
        const errorText = await typhoonResponse.text()
        throw new Error(`Typhoon OCR failed: ${errorText}`)
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
      alert(`Error extracting text: ${error instanceof Error ? error.message : "Please try again."}`)
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-background text-foreground">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background text-foreground pb-8 font-mono">
      {/* Header */}
      <div className="bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md border-b border-border/20 px-3 py-3 mb-2">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-foreground">FCD Tracker</h1>
          </div>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-cyan-500 text-black font-bold border-none hover:bg-cyan-400 text-xs tracking-wider"
          >
            UPLOAD SLIP
          </Button>
        </div>
      </div>

      <div className="px-2 space-y-2">
        {/* Summary Cards */}
        {/* Summary Cards */}
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Liquidity Section */}
          <div className="bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md rounded-none p-3 border border-border/20 shadow-none">
            <h3 className="text-sm font-bold text-muted-foreground/60 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Liquidity
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Cash Remain</div>
                  <div className={`text-2xl font-bold ${stats && stats.cash_remain < 0 ? 'text-rose-400' : 'text-foreground'}`}>
                    {formatCurrency(stats?.cash_remain || 0, "USD")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground/60 mb-1">Net Flow</div>
                  <div className={`text-sm font-medium px-2 py-1 rounded-full ${stats && stats.cash_remain >= 0 ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/20 text-rose-400'}`}>
                    {stats && stats.cash_remain >= 0 ? '+' : ''}{((stats?.cash_remain || 0) / (stats?.total_in || 1) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10">
                <div>
                  <div className="text-xs text-muted-foreground/60 mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    Total In
                  </div>
                  <div className="text-lg font-bold text-emerald-400">{formatCurrency(stats?.total_in || 0, "USD")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground/60 mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    Total Out
                  </div>
                  <div className="text-lg font-bold text-rose-400">{formatCurrency(stats?.total_out || 0, "USD")}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md rounded-none p-3 border border-border/20 shadow-none">
            <h3 className="text-sm font-bold text-muted-foreground/60 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Performance
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Gold Profit</div>
                <div className={`text-xl font-bold ${stats && stats.gold_profit >= 0 ? 'text-amber-500' : 'text-rose-400'}`}>
                  {stats && stats.gold_profit > 0 ? '+' : ''}{formatCurrency(stats?.gold_profit || 0, "USD")}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Interest Income</div>
                <div className="text-xl font-bold text-cyan-400">
                  +{formatCurrency(stats?.interest_income || 0, "USD")}
                </div>
              </div>
              <div className="col-span-2 pt-4 border-t border-border/10 flex justify-between items-center">
                <div className="text-xs text-muted-foreground/60">Weighted Avg Rate</div>
                <div className="text-2xl font-mono font-medium text-foreground/90 tracking-tight">
                  {stats?.weighted_avg_rate.toFixed(4) || "0.0000"} <span className="text-xs text-muted-foreground/60 font-mono">THB/USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exchange Rate Chart */}
        {rateChartData.length > 0 && (
          <div className="bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md rounded-none p-3 border border-border/20 shadow-none">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Exchange Rate Trend</h2>
                <p className="text-xs text-muted-foreground mt-1">Rate fluctuations over time</p>
              </div>
              <div className="text-xs font-medium px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg">LIVE</div>
            </div>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#52525b"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    angle={-90}
                    textAnchor="end"
                    height={50}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(value: number) => value.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                    itemStyle={{ color: "#f8fafc" }}
                    labelStyle={{ color: "#52525b", marginBottom: "0.25rem", fontSize: "0.75rem" }}
                    formatter={(value: any) => [value ? Number(value).toFixed(4) : "0.0000", 'Rate']}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    dot={{ r: 0, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: "#67e8f9", strokeWidth: 3, fill: "#fff" }}
                    name="Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Add Entry Form */}
        <div className="bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md rounded-none border border-border/20 shadow-none overflow-hidden">
          <button
            onClick={() => setShowAddEntry(!showAddEntry)}
            className="w-full px-3 py-3 flex justify-between items-center text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <h2 className="text-base font-bold text-foreground">Add New Entry</h2>
            </div>
            <span className={`text-muted-foreground/60 transition-transform duration-200 ${showAddEntry ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </span>
          </button>
          {showAddEntry && (
            <div className="px-3 pb-4 pt-1 space-y-3 border-t border-border/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Transaction Type</span>
                  <select
                    value={entryData.tx_type}
                    onChange={(e) => handleTxTypeChange(e.target.value as FCDTxType)}
                    className="w-full px-3 py-2.5 border border-border/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md transition-all shadow-none"
                  >
                    <option value="FX">💱 FX Exchange</option>
                    <option value="GOLD_BUY">🟡 Gold Buy</option>
                    <option value="GOLD_SELL">💰 Gold Sell</option>
                    <option value="INTEREST">📈 Interest</option>
                    <option value="TRANSFER">↔️ Transfer</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Date & Time</span>
                  <Input
                    type="datetime-local"
                    value={entryData.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryData({ ...entryData, date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all shadow-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">USD Amount</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={entryData.usd || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryData({ ...entryData, usd: Number.parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border border-border/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all shadow-none font-medium"
                    placeholder="0.00"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Status</span>
                  <select
                    value={entryData.status}
                    onChange={(e) => setEntryData({ ...entryData, status: e.target.value })}
                    disabled={entryData.tx_type !== 'TRANSFER'}
                    className="w-full px-3 py-2.5 border border-border/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md disabled:bg-white/5 disabled:text-muted-foreground/60 transition-all shadow-none"
                  >
                    <option value="IN">Create Income (IN)</option>
                    <option value="OUT">Create Expense (OUT)</option>
                    <option value="Interest">Interest Income</option>
                  </select>
                </label>

                {entryData.tx_type === 'FX' && (
                  <>
                    <label className="block">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">THB Amount</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={entryData.thb || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryData({ ...entryData, thb: Number.parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 border border-border/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all shadow-none"
                        placeholder="0.00"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Exchange Rate</span>
                      <Input
                        type="number"
                        step="0.0001"
                        value={entryData.rate || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryData({ ...entryData, rate: Number.parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 border border-border/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all shadow-none"
                        placeholder="0.0000"
                      />
                    </label>
                  </>
                )}

                <label className="block md:col-span-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Note</span>
                  <Input
                    type="text"
                    value={entryData.note || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryData({ ...entryData, note: e.target.value })}
                    className="w-full px-3 py-2 border border-border/30 rounded-none text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/40 bg-black/20 shadow-none"
                    placeholder="Optional description..."
                  />
                </label>
              </div>

              <Button onClick={handleAddEntry} className="w-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 py-3 h-12 rounded-none border border-cyan-500/40 shadow-none tracking-[0.16em]">
                {entryData.tx_type === 'FX' ? '+ CONFIRM FX' : '+ CONFIRM ENTRY'}
              </Button>
            </div>
          )}
        </div>

        {/* Entries List */}
        <div className="bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md rounded-none border border-border/20 shadow-none">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-foreground">Recent Transactions</h2>
            <span className="text-xs font-medium text-muted-foreground/60">{entries.length} records</span>
          </div>
          <div className="space-y-0">
            {(() => {
              const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const totalPages = Math.ceil(sortedEntries.length / 10);
              const paginatedEntries = sortedEntries.slice((currentPage - 1) * 10, currentPage * 10);

              return (
                <>
                  {paginatedEntries.map((entry) => {
                let icon;
                let txLabel = entry.tx_type as string;
                let amountColor = 'text-foreground';

                // Determine Icon and Label style
                if (entry.tx_type === 'FX') {
                  icon = <span className="text-lg">💱</span>;
                  txLabel = 'FX Exchange';
                } else if (entry.tx_type === 'GOLD_BUY') {
                  icon = <span className="text-lg">🟡</span>;
                  txLabel = 'Gold Buy';
                  amountColor = 'text-foreground';
                } else if (entry.tx_type === 'GOLD_SELL') {
                  icon = <span className="text-lg">💰</span>;
                  txLabel = 'Gold Sell';
                  amountColor = 'text-emerald-400';
                } else if (entry.tx_type === 'INTEREST' || entry.status === 'Interest') {
                  icon = <span className="text-lg">📈</span>;
                  txLabel = 'Interest';
                  amountColor = 'text-cyan-400';
                } else {
                  icon = <span className="text-lg">↔️</span>;
                  txLabel = 'Transfer';
                }

                // Override color based on status if needed
                if (entry.status === 'OUT' && amountColor === 'text-foreground') amountColor = 'text-foreground';
                // We keep it neutral for OUT, or red if preferred. The prompt didn't specify, but neutral/dark is clean.
                // Let's make OUT amounts slightly visually distinct? 
                // Actually sticking to "Performance" colors (profit=green) is better.

                return (
                  <div key={entry.id} className="group p-3 bg-transparent rounded-none border-b border-border/20 last:border-b-0 hover:bg-white/5 transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-none bg-black/20 flex items-center justify-center border border-border/20 group-hover:bg-cyan-500/10 transition-all text-sm">
                          {icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{txLabel}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${entry.status === 'IN' || entry.status === 'Interest'
                              ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/15 border border-rose-500/20 text-rose-400'
                              }`}>
                              {entry.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{format(parseISO(entry.date), "dd MMM yyyy, HH:mm")}</span>
                            {entry.rate && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="font-medium text-muted-foreground">@{Number(entry.rate).toFixed(4)}</span>
                              </>
                            )}
                          </div>
                          {entry.note && (
                            <div className="mt-2 text-xs text-muted-foreground bg-white/5 px-2.5 py-1.5 rounded-lg inline-block border border-border/20 italic">
                              {entry.note}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm tracking-tight font-bold ${amountColor}`}>
                          {entry.status === 'OUT' ? '-' : '+'}{formatCurrency(entry.usd, "USD")}
                        </div>
                        {entry.thb && (
                          <div className="text-xs text-muted-foreground/60 mt-0.5 font-medium">
                            {formatCurrency(entry.thb, "THB")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {entries.length === 0 && (
                <div className="text-center py-12 text-muted-foreground/60 bg-white/5 rounded-xl border border-dashed border-border/20">
                  <div className="text-4xl mb-3">📝</div>
                  <p>No transactions yet.</p>
                  <button onClick={() => setShowAddEntry(true)} className="text-cyan-400 font-medium text-sm mt-2 hover:underline">
                    Add your first entry
                  </button>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex justify-between items-center p-3 border-t border-border/20 bg-black/10">
                  <Button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-black/20 hover:bg-white/5 border border-border/30 text-[10px] tracking-widest px-3 h-8 rounded-none disabled:opacity-30 disabled:hover:bg-black/20"
                  >
                    PREV
                  </Button>
                  <span className="text-[10px] text-muted-foreground/60 font-mono tracking-[0.2em] font-bold">PAGE {currentPage}/{totalPages}</span>
                  <Button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-black/20 hover:bg-white/5 border border-border/30 text-[10px] tracking-widest px-3 h-8 rounded-none disabled:opacity-30 disabled:hover:bg-black/20"
                  >
                    NEXT
                  </Button>
                </div>
              )}
            </>
          );
        })()}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed top-0 inset-x-0 z-[60] h-[100dvh] bg-black/70 backdrop-blur-md flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-[oklch(0.09_0.012_255/0.95)] border-t sm:border border-border/30 rounded-none p-4 pb-12 sm:pb-6 max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-border/20 pb-3">
              <h3 className="text-sm tracking-[0.1em] font-bold text-foreground uppercase">Upload Slip</h3>
              <button
                onClick={resetOCR}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-muted-foreground text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-bold
                  file:bg-cyan-500 text-black font-bold file:text-white
                  hover:file:bg-cyan-400"
              />

              {image && (
                <div className="w-full rounded-lg overflow-hidden border border-border/20">
                  <img src={image} alt="Uploaded slip" className="w-full h-auto" />
                </div>
              )}

              <Button
                onClick={extractText}
                disabled={ocrLoading}
                className="w-full bg-cyan-500 text-black font-bold hover:bg-cyan-400 text-white py-3 font-bold disabled:opacity-50"
              >
                {ocrLoading ? `Extracting… ${ocrProgress}%` : "Extract text"}
              </Button>

              {modalFields && (
                <div className="space-y-3 pt-2 border-t border-border/20">
                  <div className="text-sm text-muted-foreground bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/30">
                    Review and adjust values before filling the form.
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium text-foreground/90 mb-1 block">USD</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={modalFields.USD ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setModalFields({ ...modalFields, USD: Number.parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-border/20 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-foreground/90 mb-1 block">THB</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={modalFields.THB ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setModalFields({ ...modalFields, THB: Number.parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-border/20 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-foreground/90 mb-1 block">Rate</span>
                    <Input
                      type="number"
                      step="0.0001"
                      value={modalFields.Rate ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setModalFields({ ...modalFields, Rate: Number.parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-border/20 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-foreground/90 mb-1 block">Date</span>
                    <Input
                      type="text"
                      value={modalFields.Date ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModalFields({ ...modalFields, Date: e.target.value })}
                      className="w-full px-3 py-2 border border-border/20 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="22 Dec 2025 - 12:30 AM"
                    />
                  </label>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={resetOCR} className="flex-1 bg-transparent border border-border/30 hover:bg-white/5 text-foreground py-3 h-12">
                      Clear
                    </Button>
                    <Button onClick={fillFromModal} className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400 py-3 h-12 border border-cyan-500/40">
                      Fill Data
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

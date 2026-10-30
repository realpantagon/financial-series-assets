import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// iOS-style: "chip" is a standalone pill; "segment" sits inside a grouped track.
const itemVariants = cva(
  "group press inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        chip: "h-9 rounded-full bg-card px-4 text-[15px] text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
        segment: "h-9 flex-1 rounded-[10px] px-3 text-[15px] text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
      },
    },
    defaultVariants: { variant: "chip" },
  }
)

type Variant = NonNullable<VariantProps<typeof itemVariants>["variant"]>
const VariantContext = React.createContext<Variant>("chip")

function ToggleGroup({
  className,
  variant = "chip",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & { variant?: Variant }) {
  return (
    <VariantContext.Provider value={variant}>
      <ToggleGroupPrimitive.Root
        data-slot="toggle-group"
        className={cn(
          variant === "segment" ? "flex w-full gap-1 rounded-xl bg-muted p-1" : "flex flex-wrap items-center gap-2",
          className
        )}
        {...props}
      />
    </VariantContext.Provider>
  )
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const variant = React.useContext(VariantContext)
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(itemVariants({ variant }), className)}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }

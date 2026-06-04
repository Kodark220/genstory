import * as React from "react"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }>(
  ({ className, variant = "default", ...props }, ref) => {
    const v = variant === "default" ? "bg-primary text-primary-foreground" :
      variant === "secondary" ? "bg-secondary text-secondary-foreground" :
      variant === "destructive" ? "bg-destructive text-destructive-foreground" :
      "text-foreground border border-border"
    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${v} ${className || ''}`}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }

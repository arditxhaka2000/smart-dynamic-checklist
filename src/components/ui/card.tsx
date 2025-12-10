import * as React from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/40 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-4 pb-2 flex items-center justify-between gap-3", props.className)} {...props} />
}

export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-semibold text-slate-100", props.className)} {...props} />
}

export function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-slate-400", props.className)} {...props} />
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-4 pt-2 space-y-3", props.className)} {...props} />
}

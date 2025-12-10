import * as React from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--card)] shadow-xl shadow-[0_24px_60px_-28px_var(--card-shadow)] backdrop-blur-sm",
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
  return <h2 className={cn("text-sm font-semibold text-[color:var(--text)]", props.className)} {...props} />
}

export function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-[color:var(--text-dim)]", props.className)} {...props} />
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-4 pt-2 space-y-3", props.className)} {...props} />
}

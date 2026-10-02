import * as React from "react"

import { cn } from "@/lib/utils"

type CardProps = React.ComponentProps<"div"> & {
  /** Legacy: pre-shadcn density flag. Ignored; removed after Phase 4. */
  tone?: string
  /** Legacy: pre-shadcn glow flag. Ignored; removed after Phase 4. */
  glow?: boolean
}

function Card({ className, tone: _tone, glow: _glow, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

type CardHeaderProps = React.ComponentProps<"div"> & {
  /** Legacy: pre-shadcn header title text. Rendered above children. Removed after Phase 4. */
  title?: React.ReactNode
  /** Legacy: pre-shadcn header subtitle text. Removed after Phase 4. */
  subtitle?: React.ReactNode
}

function CardHeader({ className, title, subtitle, children, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    >
      {title ? <div className="leading-none font-semibold">{title}</div> : null}
      {subtitle ? <div className="text-muted-foreground text-sm">{subtitle}</div> : null}
      {children}
    </div>
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

// Legacy alias retained until feature files are migrated (Phase 2-4).
const CardBody = CardContent

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardBody,
}

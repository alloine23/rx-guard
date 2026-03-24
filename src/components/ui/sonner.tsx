"use client"

import { Toaster as Sonner } from "sonner"

function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!border-emerald-500/20 group-[.toaster]:!bg-emerald-500/5 group-[.toaster]:!text-emerald-700 dark:group-[.toaster]:!text-emerald-400",
          error:
            "group-[.toaster]:!border-destructive/20 group-[.toaster]:!bg-destructive/5 group-[.toaster]:!text-destructive",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

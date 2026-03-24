import { Logo } from '@/components/logo'

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex items-center gap-2">
        <Logo size={32} />
        <span className="text-lg font-semibold">RxGuard</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">
        RxGuard Prescription Verification System
      </p>
    </div>
  )
}

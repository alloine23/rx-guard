'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'

// Floating particle component for the brand panel
function FloatingParticle({
  delay,
  duration,
  x,
  y,
  size,
}: {
  delay: number
  duration: number
  x: string
  y: string
  size: number
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-white/[0.04] backdrop-blur-[2px]"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{
        y: [0, -20, 0, 15, 0],
        x: [0, 10, -5, 8, 0],
        opacity: [0.3, 0.6, 0.4, 0.7, 0.3],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

// Animated feature badge
function FeatureBadge({
  children,
  delay,
}: {
  children: React.ReactNode
  delay: number
}) {
  return (
    <motion.div
      className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className="h-1 w-1 rounded-full bg-[oklch(0.65_0.14_175)] shadow-[0_0_6px_oklch(0.65_0.14_175/0.6)]" />
      {children}
    </motion.div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* ═══════════ Brand Panel (Left Half) ═══════════ */}
      <div className="relative hidden overflow-hidden bg-[oklch(0.10_0.025_195)] lg:flex lg:items-center lg:justify-center">
        {/* Base gradient mesh */}
        <div className="absolute inset-0">
          <div className="absolute -top-32 -left-32 h-[700px] w-[700px] rounded-full bg-[oklch(0.22_0.12_175)] opacity-40 blur-[180px]" />
          <div className="absolute bottom-[-15%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[oklch(0.18_0.10_210)] opacity-35 blur-[160px]" />
          <div className="absolute top-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[oklch(0.20_0.09_190)] opacity-25 blur-[140px]" />
        </div>

        {/* Floating particles */}
        <FloatingParticle delay={0} duration={8} x="15%" y="25%" size={6} />
        <FloatingParticle delay={1.5} duration={10} x="75%" y="18%" size={4} />
        <FloatingParticle delay={3} duration={9} x="60%" y="70%" size={5} />
        <FloatingParticle delay={2} duration={11} x="25%" y="65%" size={7} />
        <FloatingParticle delay={4} duration={7} x="80%" y="50%" size={3} />
        <FloatingParticle delay={0.5} duration={12} x="45%" y="85%" size={5} />
        <FloatingParticle delay={2.5} duration={9} x="10%" y="45%" size={4} />

        {/* Floating geometric shapes */}
        <motion.div
          className="absolute right-[12%] top-[14%] h-36 w-36 rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-[1px]"
          animate={{ rotate: [12, 18, 12], y: [0, -10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[18%] left-[10%] h-28 w-28 rounded-full border border-white/[0.05] bg-gradient-to-tr from-[oklch(0.65_0.14_175/0.04)] to-transparent"
          animate={{ scale: [1, 1.06, 1], y: [0, 8, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[35%] right-[25%] h-20 w-20 rounded-2xl border border-white/[0.04] bg-gradient-to-bl from-white/[0.02] to-transparent"
          animate={{ rotate: [-8, -14, -8], x: [0, 6, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Grain texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Main content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          {/* Top: Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3">
              <Logo size={44} glow />
              <span className="text-xl font-semibold tracking-tight text-white">
                RxGuard
              </span>
            </div>
          </motion.div>

          {/* Center: Hero messaging */}
          <div className="max-w-md space-y-6">
            <motion.h1
              className="text-[2.25rem] leading-[1.1] font-bold tracking-tight text-white xl:text-[2.5rem]"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7, ease: 'easeOut' }}
            >
              Digitize.{' '}
              <motion.span
                className="inline-block bg-gradient-to-r from-[oklch(0.78_0.14_175)] to-[oklch(0.60_0.16_190)] bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                Protect.
              </motion.span>
              <br />
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
              >
                Deliver care.
              </motion.span>
            </motion.h1>

            <motion.p
              className="max-w-md text-[0.85rem] leading-relaxed text-white/45"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              A computer vision-based electronic health record system for secure
              medical record digitization, prescription verification, and
              consent-gated data sharing.
            </motion.p>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3">
              <FeatureBadge delay={1.0}>HIPAA-aligned</FeatureBadge>
              <FeatureBadge delay={1.15}>RA 10173 compliant</FeatureBadge>
              <FeatureBadge delay={1.3}>AES-256-GCM</FeatureBadge>
              <FeatureBadge delay={1.45}>CV-powered OCR</FeatureBadge>
            </div>
          </div>

          {/* Bottom: Tagline */}
          <motion.div
            className="flex items-center gap-3 text-xs text-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.8 }}
          >
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="whitespace-nowrap">Computer Vision-Based EHR System</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </motion.div>
        </div>
      </div>

      {/* ═══════════ Form Panel (Right Half) ═══════════ */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-background px-6">
        {/* Subtle teal glow bleed from left panel */}
        <div className="pointer-events-none absolute -left-32 top-1/2 hidden h-[600px] w-[350px] -translate-y-1/2 rounded-full bg-[oklch(0.55_0.14_175)] opacity-[0.025] blur-[120px] lg:block" />

        <motion.div
          className="w-full max-w-[400px]"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile logo */}
          <motion.div
            className="mb-10 flex items-center gap-3 lg:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Logo size={36} />
            <span className="text-lg font-semibold tracking-tight">
              RxGuard
            </span>
          </motion.div>

          {/* Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your credentials to access the system
            </p>
          </motion.div>

          {/* Form card */}
          <motion.div
            className="rounded-2xl border border-border/40 bg-card/50 p-6 shadow-sm backdrop-blur-sm dark:bg-card/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <Label
                  htmlFor="email"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="doctor@hospital.ph"
                  required
                  autoFocus
                  autoComplete="email"
                  className="h-11 rounded-xl border-border/50 bg-muted/30 px-4 text-sm transition-all duration-200 placeholder:text-muted-foreground/40 hover:border-border focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-border/50 bg-muted/30 px-4 text-sm transition-all duration-200 placeholder:text-muted-foreground/40 hover:border-border focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </motion.div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline underline-offset-2"
                >
                  Forgot your password?
                </Link>
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="pt-1"
              >
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="h-11 w-full rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </motion.div>
            </form>
          </motion.div>

          {/* Footer */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.6 }}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Protected by end-to-end encryption
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

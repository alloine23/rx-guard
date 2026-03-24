'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  Loader2,
  ShieldCheck,
  Building2,
  QrCode,
  Info,
} from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/components/logo'

interface IDCardData {
  patientCode: string
  fullName: string
  dateOfBirth: string
  phone: string | null
  photoUrl: string | null
}

function computeAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function PatientIDCardPage() {
  const [data, setData] = useState<IDCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch('/api/patient/id-card')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? 'Failed to load ID card data')
          return
        }
        const json: IDCardData = await res.json()
        setData(json)

        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(json.patientCode, {
          width: 240,
          margin: 1,
          color: { dark: '#0f766e', light: '#ffffff' },
        })
        setQrDataUrl(url)
      })
      .catch(() => setError('Failed to load ID card data'))
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await sileo.promise(
        fetch('/api/patient/id-card/pdf').then(async (res) => {
          if (!res.ok) throw new Error('Failed to generate PDF')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `rxguard-id-${data?.patientCode ?? 'card'}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }),
        {
          loading: { title: 'Generating PDF...', description: 'Preparing your ID card for download.' },
          success: { title: 'ID card downloaded' },
          error: { title: 'Download failed', description: 'Please try again later.' },
        },
      )
    } catch {
      // Error already shown by sileo.promise
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-64 rounded-lg" />
        </div>
        <div className="mx-auto max-w-lg">
          <Skeleton className="aspect-[1.586/1] w-full rounded-2xl" />
          <Skeleton className="mx-auto mt-4 h-10 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Digital ID Card</h2>
          <p className="text-sm text-muted-foreground">
            Your RxGuard patient identification card
          </p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const age = computeAge(data.dateOfBirth)
  const dob = new Date(data.dateOfBirth).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Digital ID Card</h2>
        <p className="text-sm text-muted-foreground">
          Your RxGuard patient identification card
        </p>
      </div>

      {/* ── Card + Actions ── */}
      <div className="mx-auto max-w-lg space-y-5">
        {/* Card */}
        <div className="group relative mx-auto">
          {/* Ambient glow */}
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-teal-400/20 via-teal-500/10 to-emerald-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100 dark:from-teal-400/10 dark:via-teal-500/5 dark:to-emerald-500/10" />

          <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-900 to-emerald-950 shadow-xl shadow-black/20 dark:shadow-black/40">
            {/* Holographic sheen — diagonal sweep */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] transition-opacity duration-500 group-hover:opacity-[0.12]"
              style={{
                backgroundImage: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 45%, transparent 55%)',
              }}
            />
            {/* Subtle noise texture */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
              backgroundSize: '16px 16px',
            }} />

            {/* Content */}
            <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
              {/* Top: branding + chip */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <Logo size={36} glow />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight text-white">
                      RxGuard
                    </span>
                    <span className="text-[10px] font-medium leading-none text-teal-300/60">
                      Patient ID Card
                    </span>
                  </div>
                </div>
                {/* EMV chip */}
                <div className="mt-0.5 h-7 w-9 rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 shadow-sm shadow-black/20">
                  <div className="mx-auto mt-[5px] h-[14px] w-5 rounded-[2px] border border-amber-500/40 bg-gradient-to-b from-amber-100/60 to-amber-300/60" />
                </div>
              </div>

              {/* Middle: patient code (embossed credit-card number style) */}
              <div className="my-auto">
                <p className="font-mono text-lg font-bold tracking-[0.2em] text-white/90 sm:text-xl" style={{
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}>
                  {data.patientCode}
                </p>
              </div>

              {/* Bottom: info row + QR */}
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  {/* Name */}
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-teal-300/40">
                      Patient Name
                    </p>
                    <p className="truncate text-sm font-bold uppercase tracking-wide text-white/90 sm:text-base">
                      {data.fullName}
                    </p>
                  </div>

                  {/* DOB + Phone */}
                  <div className="flex gap-5">
                    <div>
                      <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-teal-300/40">
                        Date of Birth
                      </p>
                      <p className="text-[11px] font-medium text-white/70">
                        {dob} ({age})
                      </p>
                    </div>
                    {data.phone && (
                      <div>
                        <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-teal-300/40">
                          Phone
                        </p>
                        <p className="text-[11px] font-medium text-white/70">
                          {data.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* QR code */}
                <div className="shrink-0">
                  {qrDataUrl ? (
                    <div className="flex flex-col items-center">
                      <div className="rounded-lg bg-white p-1.5 shadow-md shadow-black/20">
                        <img
                          src={qrDataUrl}
                          alt="QR code for patient verification"
                          className="size-16 sm:size-[72px]"
                        />
                      </div>
                      <span className="mt-1 text-[7px] font-medium uppercase tracking-[0.15em] text-teal-300/30">
                        Scan to verify
                      </span>
                    </div>
                  ) : (
                    <Skeleton className="size-16 rounded-lg bg-white/10 sm:size-[72px]" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Download */}
        <Button
          onClick={handleDownload}
          disabled={downloading}
          size="lg"
          className="w-full rounded-xl"
        >
          {downloading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          {downloading ? 'Generating PDF...' : 'Download as PDF'}
        </Button>
      </div>

      {/* ── Info cards ── */}
      <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
            <Building2 className="size-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs font-semibold">Pharmacy Access</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Show at any partner pharmacy to access prescriptions
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
            <QrCode className="size-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs font-semibold">QR Verification</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Pharmacists scan the code to look up your records
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
            <ShieldCheck className="size-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs font-semibold">Consent Required</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Access is only granted with your active consent
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

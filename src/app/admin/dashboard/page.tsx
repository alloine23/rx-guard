'use client'

import { useEffect, useState } from 'react'
import {
  Stethoscope,
  Users,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  Activity,
  FileText,
  Pill,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'

/* ─────────── Types ─────────── */

interface HospitalStats {
  institutionType: 'hospital'
  doctors: number
  patients: number
  records: number
  pendingConsents: number
}

interface PharmacyStats {
  institutionType: 'pharmacy'
  pharmacists: number
  verifications: number
  dispensed: number
  verified: number
  rejected: number
}

type AdminStats = HospitalStats | PharmacyStats

/* ─────────── Mock Data Generators ─────────── */

function generateHospitalActivityData(stats: HospitalStats) {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
  const seed = [0.35, 0.48, 0.58, 0.72, 0.85, 1.0]
  return months.map((month, i) => ({
    month,
    patients: Math.round(stats.patients * seed[i] * (0.9 + Math.random() * 0.2)),
    doctors: Math.round(stats.doctors * seed[i] * (0.9 + Math.random() * 0.2)),
  }))
}

function generatePharmacyActivityData(stats: PharmacyStats) {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
  const seed = [0.35, 0.48, 0.58, 0.72, 0.85, 1.0]
  return months.map((month, i) => ({
    month,
    dispensed: Math.round(stats.dispensed * seed[i] * (0.9 + Math.random() * 0.2)),
    rejected: Math.round(stats.rejected * seed[i] * (0.9 + Math.random() * 0.2)),
  }))
}

function generateConsentData(pendingConsents: number) {
  const approved = pendingConsents * 3
  const revoked = Math.round(pendingConsents * 0.5)
  return [
    { status: 'approved', count: approved, fill: 'var(--color-approved)' },
    { status: 'pending', count: pendingConsents, fill: 'var(--color-pending)' },
    { status: 'revoked', count: revoked, fill: 'var(--color-revoked)' },
  ]
}

/* ─────────── Chart Configs ─────────── */

const hospitalActivityConfig = {
  patients: { label: 'Patients', color: '#0d9488' },
  doctors: { label: 'Doctors', color: '#06b6d4' },
} satisfies ChartConfig

const pharmacyActivityConfig = {
  dispensed: { label: 'Dispensed', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
} satisfies ChartConfig

const consentConfig = {
  approved: { label: 'Approved', color: '#10b981' },
  pending: { label: 'Pending', color: '#f59e0b' },
  revoked: { label: 'Revoked', color: '#ef4444' },
} satisfies ChartConfig

const verificationOutcomeConfig = {
  dispensed: { label: 'Dispensed', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
} satisfies ChartConfig

/* ─────────── Skeletons ─────────── */

function StatSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-14" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

/* ─────────── Stat Card ─────────── */

interface StatCardProps {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  description: string
  accent: string
}

function StatCard({ label, value, icon: Icon, description, accent }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-5">
      <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground/60" />
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="size-3 text-primary" />
        {description}
      </p>
    </div>
  )
}

/* ─────────── Page ─────────── */

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) throw new Error('Failed to load stats')
        const data: AdminStats = await res.json()
        setStats(data)
      } catch {
        setError('Unable to load dashboard statistics.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  const isPharmacy = stats?.institutionType === 'pharmacy'
  const isHospital = stats?.institutionType === 'hospital'

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isPharmacy ? 'Pharmacy Dashboard' : isHospital ? 'Hospital Dashboard' : 'Institution Dashboard'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isPharmacy
              ? 'Manage your pharmacists and prescriptions.'
              : isHospital
                ? 'Manage your doctors, patients, and consent requests.'
                : 'Manage your staff and operations.'}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
        ) : isHospital ? (
          <>
            <StatCard
              label="Doctors"
              value={(stats as HospitalStats).doctors}
              icon={Stethoscope}
              description="Registered in your institution"
              accent="bg-teal-500/60"
            />
            <StatCard
              label="Patients"
              value={(stats as HospitalStats).patients}
              icon={Users}
              description="Total patient records"
              accent="bg-cyan-500/60"
            />
            <StatCard
              label="Medical Records"
              value={(stats as HospitalStats).records}
              icon={FileText}
              description="Uploaded across your institution"
              accent="bg-indigo-500/60"
            />
          </>
        ) : isPharmacy ? (
          <>
            <StatCard
              label="Pharmacists"
              value={(stats as PharmacyStats).pharmacists}
              icon={Pill}
              description="Registered in your pharmacy"
              accent="bg-violet-500/60"
            />
            <StatCard
              label="Verifications"
              value={(stats as PharmacyStats).verifications}
              icon={ClipboardCheck}
              description="Total prescriptions processed"
              accent="bg-cyan-500/60"
            />
            <StatCard
              label="Pending Dispense"
              value={(stats as PharmacyStats).verified}
              icon={ClipboardList}
              description="Verified, awaiting dispensing"
              accent="bg-amber-500/60"
            />
          </>
        ) : null}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : isHospital ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Hospital: Activity Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Activity Overview</CardTitle>
              <CardDescription>Patient and doctor registrations over 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={hospitalActivityConfig} className="aspect-auto h-[260px] w-full">
                <AreaChart data={generateHospitalActivityData(stats as HospitalStats)} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="fillPatients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-patients)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-patients)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillDoctors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-doctors)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-doctors)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={4} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area type="monotone" dataKey="patients" stroke="var(--color-patients)" strokeWidth={2} fill="url(#fillPatients)" />
                  <Area type="monotone" dataKey="doctors" stroke="var(--color-doctors)" strokeWidth={2} fill="url(#fillDoctors)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Hospital: Consent Status Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Consent Status</CardTitle>
              <CardDescription>Distribution of patient consent requests</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {(() => {
                const consentData = generateConsentData((stats as HospitalStats).pendingConsents)
                const totalConsents = consentData.reduce((sum, d) => sum + d.count, 0)
                if (totalConsents === 0) {
                  return (
                    <div className="flex h-[260px] flex-col items-center justify-center text-center">
                      <ClipboardList className="size-8 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-medium text-muted-foreground">No consent data yet</p>
                      <p className="mt-1 text-xs text-muted-foreground/60">Consent statistics will appear once patients submit requests.</p>
                    </div>
                  )
                }
                return (
                  <ChartContainer config={consentConfig} className="aspect-square h-[260px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                      <Pie
                        data={consentData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={60}
                        outerRadius={95}
                        strokeWidth={2}
                        paddingAngle={3}
                        cornerRadius={4}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                                    {totalConsents}
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                                    Total consents
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                    </PieChart>
                  </ChartContainer>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      ) : isPharmacy ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pharmacy: Dispensing Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Dispensing Trends</CardTitle>
              <CardDescription>Dispensed and rejected prescriptions over 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={pharmacyActivityConfig} className="aspect-auto h-[260px] w-full">
                <AreaChart data={generatePharmacyActivityData(stats as PharmacyStats)} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="fillDispensed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-dispensed)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-dispensed)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-rejected)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-rejected)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={4} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area type="monotone" dataKey="dispensed" stroke="var(--color-dispensed)" strokeWidth={2} fill="url(#fillDispensed)" />
                  <Area type="monotone" dataKey="rejected" stroke="var(--color-rejected)" strokeWidth={2} fill="url(#fillRejected)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Pharmacy: Final Outcomes Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Final Outcomes</CardTitle>
              <CardDescription>Dispensed vs rejected prescriptions</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {(() => {
                const pharmacyStats = stats as PharmacyStats
                const outcomeData = [
                  { status: 'dispensed', count: pharmacyStats.dispensed, fill: 'var(--color-dispensed)' },
                  { status: 'rejected', count: pharmacyStats.rejected, fill: 'var(--color-rejected)' },
                ]
                const totalOutcomes = outcomeData.reduce((sum, d) => sum + d.count, 0)
                if (totalOutcomes === 0) {
                  return (
                    <div className="flex h-[260px] flex-col items-center justify-center text-center">
                      <ClipboardCheck className="size-8 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-medium text-muted-foreground">No outcomes yet</p>
                      <p className="mt-1 text-xs text-muted-foreground/60">Data will appear once prescriptions are dispensed or rejected.</p>
                    </div>
                  )
                }
                return (
                  <ChartContainer config={verificationOutcomeConfig} className="aspect-square h-[260px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                      <Pie
                        data={outcomeData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={60}
                        outerRadius={95}
                        strokeWidth={2}
                        paddingAngle={3}
                        cornerRadius={4}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                                    {totalOutcomes}
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                                    Completed
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                    </PieChart>
                  </ChartContainer>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

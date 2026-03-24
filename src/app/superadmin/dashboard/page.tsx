'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  Pill,
  Stethoscope,
  Users,
  TrendingUp,
  Activity,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

interface Stats {
  hospitals: number
  pharmacies: number
  doctors: number
  patients: number
}

/* ─────────── Mock Data Generators ─────────── */

function generateGrowthData(stats: Stats) {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
  const seed = [0.35, 0.48, 0.58, 0.72, 0.85, 1.0]
  return months.map((month, i) => ({
    month,
    patients: Math.round(stats.patients * seed[i] * (0.9 + Math.random() * 0.2)),
    doctors: Math.round(stats.doctors * seed[i] * (0.9 + Math.random() * 0.2)),
  }))
}

function generateInstitutionData(stats: Stats) {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
  const seed = [0.4, 0.55, 0.65, 0.75, 0.9, 1.0]
  return months.map((month, i) => ({
    month,
    hospitals: Math.round(stats.hospitals * seed[i] * (0.9 + Math.random() * 0.2)),
    pharmacies: Math.round(stats.pharmacies * seed[i] * (0.9 + Math.random() * 0.2)),
  }))
}

function generateRoleDistribution(stats: Stats) {
  return [
    { role: 'doctors', count: stats.doctors, fill: 'var(--color-doctors)' },
    { role: 'patients', count: stats.patients, fill: 'var(--color-patients)' },
    { role: 'hospitals', count: stats.hospitals, fill: 'var(--color-hospitals)' },
    { role: 'pharmacies', count: stats.pharmacies, fill: 'var(--color-pharmacies)' },
  ]
}

/* ─────────── Chart Configs ─────────── */

const growthConfig = {
  patients: { label: 'Patients', color: '#0d9488' },
  doctors: { label: 'Doctors', color: '#06b6d4' },
} satisfies ChartConfig

const institutionConfig = {
  hospitals: { label: 'Hospitals', color: '#0d9488' },
  pharmacies: { label: 'Pharmacies', color: '#f59e0b' },
} satisfies ChartConfig

const roleConfig = {
  doctors: { label: 'Doctors', color: '#06b6d4' },
  patients: { label: 'Patients', color: '#0d9488' },
  hospitals: { label: 'Hospitals', color: '#10b981' },
  pharmacies: { label: 'Pharmacies', color: '#f59e0b' },
} satisfies ChartConfig

/* ─────────── Stat Cards Config ─────────── */

const statCards = [
  {
    key: 'hospitals' as const,
    label: 'Hospitals',
    icon: Building2,
    description: 'Registered hospital institutions',
    accent: 'bg-teal-500/60',
  },
  {
    key: 'pharmacies' as const,
    label: 'Pharmacies',
    icon: Pill,
    description: 'Registered pharmacy institutions',
    accent: 'bg-amber-500/60',
  },
  {
    key: 'doctors' as const,
    label: 'Doctors',
    icon: Stethoscope,
    description: 'Active doctor accounts',
    accent: 'bg-cyan-500/60',
  },
  {
    key: 'patients' as const,
    label: 'Patients',
    icon: Users,
    description: 'Total registered patients',
    accent: 'bg-emerald-500/60',
  },
]

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

/* ─────────── Page ─────────── */

export default function SuperadminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) throw new Error('Failed to fetch stats')
        setStats(await res.json())
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
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const growthData = stats ? generateGrowthData(stats) : []
  const institutionData = stats ? generateInstitutionData(stats) : []
  const roleData = stats ? generateRoleDistribution(stats) : []
  const totalUsers = roleData.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
          <p className="text-sm text-muted-foreground">
            Monitor all institutions, doctors, and patients across the platform.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : statCards.map((cfg) => {
              const Icon = cfg.icon
              return (
                <div
                  key={cfg.key}
                  className="relative overflow-hidden rounded-xl border bg-card p-5"
                >
                  <div className={`absolute inset-y-0 left-0 w-1 ${cfg.accent}`} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {cfg.label}
                    </span>
                    <Icon className="size-4 text-muted-foreground/60" />
                  </div>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                    {stats?.[cfg.key] ?? 0}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="size-3 text-primary" />
                    {cfg.description}
                  </p>
                </div>
              )
            })}
      </div>

      {/* Charts Row 1 */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Platform Growth Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Platform Growth</CardTitle>
              <CardDescription>Patient and doctor registrations over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={growthConfig} className="aspect-auto h-[260px] w-full">
                <AreaChart data={growthData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={4} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="patients"
                    stroke="var(--color-patients)"
                    strokeWidth={2}
                    fill="url(#fillPatients)"
                  />
                  <Area
                    type="monotone"
                    dataKey="doctors"
                    stroke="var(--color-doctors)"
                    strokeWidth={2}
                    fill="url(#fillDoctors)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Institution Distribution Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Institution Distribution</CardTitle>
              <CardDescription>Hospitals and pharmacies registered monthly</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={institutionConfig} className="aspect-auto h-[260px] w-full">
                <BarChart data={institutionData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={4} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="hospitals" fill="var(--color-hospitals)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pharmacies" fill="var(--color-pharmacies)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row 2 */}
      {!loading && stats && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Role Distribution Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">User Distribution</CardTitle>
              <CardDescription>Breakdown by account type</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ChartContainer config={roleConfig} className="aspect-square h-[240px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="role" hideLabel />} />
                  <Pie
                    data={roleData}
                    dataKey="count"
                    nameKey="role"
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
                                {totalUsers}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                                Total users
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="role" className="flex-wrap gap-2" />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">System Health</CardTitle>
              <CardDescription>Current platform metrics at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Hospitals', value: stats.hospitals, total: stats.hospitals + stats.pharmacies, color: 'bg-teal-500' },
                  { label: 'Pharmacies', value: stats.pharmacies, total: stats.hospitals + stats.pharmacies, color: 'bg-amber-500' },
                  { label: 'Doctor-Patient Ratio', value: stats.doctors, total: stats.patients || 1, color: 'bg-cyan-500', ratio: true },
                ].map((item) => {
                  const pct = item.ratio
                    ? Math.min(100, Math.round((item.value / item.total) * 100))
                    : Math.round((item.value / Math.max(item.total, 1)) * 100)
                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {item.ratio ? `1:${Math.round(item.total / Math.max(item.value, 1))}` : `${pct}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Total Institutions</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{stats.hospitals + stats.pharmacies}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Total Users</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{totalUsers}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

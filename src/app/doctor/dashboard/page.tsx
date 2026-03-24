'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  TrendingUp,
  Activity,
  Clock,
  FileText,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
import { Button } from '@/components/ui/button'

/* ─────────── Types ─────────── */

interface Stats {
  patients: number
  records: number
  pendingOcr: number
  monthlyRegistrations: { month: string; count: number }[]
  recordsByType: { type: string; count: number }[]
}

/* ─────────── Chart Configs ─────────── */

const registrationConfig = {
  patients: { label: 'Patients', color: '#0d9488' },
} satisfies ChartConfig

const recordsConfig = {
  records: { label: 'Records', color: '#0d9488' },
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

/* ─────────── Page ─────────── */

export default function DoctorDashboardPage() {
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

  const registrationData = (stats?.monthlyRegistrations ?? []).map(r => {
    const [, mm] = r.month.split('-')
    const label = new Date(2000, Number(mm) - 1).toLocaleString('en', { month: 'short' })
    return { month: label, patients: r.count }
  })

  const recordTypeData = (stats?.recordsByType ?? []).map(r => ({
    type: r.type.charAt(0).toUpperCase() + r.type.slice(1),
    count: r.count,
  }))

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Manage your patients and medical records from here.
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button
            render={<Link href="/doctor/patients?register=true" />}
            variant="outline"
            className="gap-2"
          >
            <UserPlus className="size-4" />
            Register Patient
          </Button>
          <Button
            render={<Link href="/doctor/patients" />}
            className="gap-2"
          >
            <Users className="size-4" />
            View Patients
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-xl border bg-card p-5">
              <div className="absolute inset-y-0 left-0 w-1 bg-teal-500/60" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  My Patients
                </span>
                <Users className="size-4 text-muted-foreground/60" />
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                {stats?.patients ?? 0}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3 text-primary" />
                Patients under your care
              </p>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-card p-5">
              <div className="absolute inset-y-0 left-0 w-1 bg-blue-500/60" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Medical Records
                </span>
                <FileText className="size-4 text-muted-foreground/60" />
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                {stats?.records ?? 0}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3 text-blue-500" />
                Total records uploaded
              </p>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-card p-5">
              <div className="absolute inset-y-0 left-0 w-1 bg-amber-500/60" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Pending OCR
                </span>
                <Clock className="size-4 text-muted-foreground/60" />
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                {stats?.pendingOcr ?? 0}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="size-3 text-amber-500" />
                Awaiting OCR processing
              </p>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Patient Registrations Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Patient Registrations</CardTitle>
              <CardDescription>6-month patient registration trend</CardDescription>
            </CardHeader>
            <CardContent>
              {registrationData.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  No registration data yet
                </div>
              ) : (
                <ChartContainer config={registrationConfig} className="aspect-auto h-[260px] w-full">
                  <AreaChart data={registrationData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="fillPatients" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-patients)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-patients)" stopOpacity={0.02} />
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
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Records by Type Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Records by Type</CardTitle>
              <CardDescription>Medical records breakdown by category</CardDescription>
            </CardHeader>
            <CardContent>
              {recordTypeData.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  No records data yet
                </div>
              ) : (
                <ChartContainer config={recordsConfig} className="aspect-auto h-[260px] w-full">
                  <BarChart data={recordTypeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="type"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={4} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="count" fill="var(--color-records)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Quick Actions</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Common tasks for patient management.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            render={<Link href="/doctor/patients" />}
            className="gap-2"
          >
            <Users className="size-4" />
            View Patients
          </Button>
          <Button
            render={<Link href="/doctor/patients?register=true" />}
            variant="outline"
            className="gap-2"
          >
            <UserPlus className="size-4" />
            Register Patient
          </Button>
        </div>
      </div>
    </div>
  )
}

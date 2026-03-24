'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Activity,
  ClipboardList,
  CreditCard,
  FileText,
  Shield,
} from 'lucide-react'
import { Label, Pie, PieChart } from 'recharts'
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

interface ConsentBreakdownItem {
  status: string
  count: number
}

interface ActivityItem {
  id: string
  action: string
  createdAt: string
  metadata: Record<string, unknown> | null
}

interface PatientStats {
  consentBreakdown: ConsentBreakdownItem[]
  totalRecords: number
  recentActivity: ActivityItem[]
}

/* ─────────── Feature Cards ─────────── */

const features = [
  {
    icon: FileText,
    title: 'Medical Records',
    description:
      'Access your digitized medical records and prescriptions uploaded by your doctor.',
  },
  {
    icon: Shield,
    title: 'Consent Grants',
    description:
      'Control which pharmacies can access your medical records and prescriptions.',
  },
  {
    icon: CreditCard,
    title: 'Digital ID Card',
    description:
      'Access your patient identification card with your unique patient code.',
  },
]

/* ─────────── Chart Config ─────────── */

const consentConfig = {
  approved: { label: 'Approved', color: '#10b981' },
  pending: { label: 'Pending', color: '#f59e0b' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  revoked: { label: 'Revoked', color: '#94a3b8' },
} satisfies ChartConfig

/* ─────────── Activity Helpers ─────────── */

const actionLabels: Record<string, string> = {
  UPLOAD_RECORD: 'Record uploaded',
  VIEW_RECORD: 'Record viewed',
  VERIFY_PRESCRIPTION: 'Prescription verified',
  DISPENSE_PRESCRIPTION: 'Prescription dispensed',
  REJECT_PRESCRIPTION: 'Prescription rejected',
  GRANT_CONSENT: 'Consent granted',
  REVOKE_CONSENT: 'Consent revoked',
  APPROVE_CONSENT: 'Consent approved',
  REJECT_CONSENT: 'Consent rejected',
}

const actionColors: Record<string, string> = {
  UPLOAD_RECORD: 'bg-teal-500',
  VIEW_RECORD: 'bg-blue-500',
  VERIFY_PRESCRIPTION: 'bg-emerald-500',
  DISPENSE_PRESCRIPTION: 'bg-green-500',
  REJECT_PRESCRIPTION: 'bg-red-500',
  GRANT_CONSENT: 'bg-amber-500',
  REVOKE_CONSENT: 'bg-slate-500',
  APPROVE_CONSENT: 'bg-emerald-500',
  REJECT_CONSENT: 'bg-red-500',
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

/* ─────────── Skeletons ─────────── */

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[240px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function ActivitySkeleton() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-1.5 size-2 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─────────── Page ─────────── */

export default function PatientDashboardPage() {
  const [stats, setStats] = useState<PatientStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      setStats(await res.json())
    } catch {
      setError('Unable to load dashboard statistics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const consentData = (stats?.consentBreakdown ?? []).map(c => ({
    status: c.status,
    count: c.count,
    fill: `var(--color-${c.status})`,
  }))

  const totalConsents = consentData.reduce((sum, d) => sum + d.count, 0)

  const activityItems = (stats?.recentActivity ?? []).map(item => ({
    id: item.id,
    action: actionLabels[item.action] ?? item.action,
    detail: (item.metadata as Record<string, string> | null)?.detail ?? '',
    time: formatTimeAgo(item.createdAt),
    color: actionColors[item.action] ?? 'bg-gray-500',
  }))

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Patient Portal</h2>
          <p className="text-sm text-muted-foreground">
            View your records, manage consent grants, and access your digital
            ID.
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.title} className="rounded-xl border bg-card p-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Charts Section */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartSkeleton />
          <ActivitySkeleton />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Donut — My Consents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                My Consents
              </CardTitle>
              <CardDescription>
                Breakdown of your consent statuses
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {consentData.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                  No consents yet
                </div>
              ) : (
                <ChartContainer
                  config={consentConfig}
                  className="aspect-square h-[240px]"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent nameKey="status" hideLabel />
                      }
                    />
                    <Pie
                      data={consentData}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      cornerRadius={4}
                      strokeWidth={2}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (
                            viewBox &&
                            'cx' in viewBox &&
                            'cy' in viewBox
                          ) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-2xl font-bold"
                                >
                                  {totalConsents}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy ?? 0) + 20}
                                  className="fill-muted-foreground text-xs"
                                >
                                  Consents
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="status" />}
                    />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Recent Activity
              </CardTitle>
              <CardDescription>
                Your latest actions and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityItems.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="space-y-4">
                  {activityItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${item.color}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.action}</p>
                        {item.detail && (
                          <p className="text-xs text-muted-foreground">
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground/60">
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Quick Actions</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Access your patient portal features.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            render={<Link href="/patient/consents" />}
            className="gap-2"
          >
            <ClipboardList className="size-4" />
            Manage Consents
          </Button>
          <Button
            render={<Link href="/patient/id-card" />}
            variant="outline"
            className="gap-2"
          >
            <CreditCard className="size-4" />
            View ID Card
          </Button>
        </div>
      </div>
    </div>
  )
}

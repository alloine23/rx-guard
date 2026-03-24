'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardCheck,
  Clock,
  Activity,
  Search,
  CheckCircle2,
  Package,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface RecentVerification {
  id: string
  recordType: string
  patientCode: string
  patientName: string
  status: 'verified' | 'dispensed' | 'rejected'
  verifiedAt: string
}

interface Stats {
  totalVerifications: number
  pendingDispense: number
  todayActivity: number
  recentVerifications: RecentVerification[]
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="size-4 text-blue-500" />
    case 'dispensed':
      return <Package className="size-4 text-emerald-500" />
    case 'rejected':
      return <XCircle className="size-4 text-red-500" />
    default:
      return null
  }
}

export default function PharmacistDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/pharmacist/stats')
      if (res.ok) {
        setStats(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Overview of your pharmacy&apos;s prescription activity
          </p>
        </div>
        <Link href="/pharmacist/search">
          <Button>
            <Search className="mr-1.5 size-4" />
            Search Patient
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <ClipboardCheck className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.totalVerifications ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Verifications</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.pendingDispense ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Pending Dispense</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Activity className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.todayActivity ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Today&apos;s Activity</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card">
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
          <span className="text-sm font-medium">Recent Verifications</span>
          <Link
            href="/pharmacist/verifications"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        {!stats?.recentVerifications.length ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No verifications yet. Search for a patient to get started.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {stats.recentVerifications.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <StatusIcon status={v.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.patientCode} &middot; {v.recordType}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="secondary"
                    className="border-0 text-[11px] capitalize"
                  >
                    {v.status}
                  </Badge>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(v.verifiedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

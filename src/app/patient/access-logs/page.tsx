'use client'

import { useCallback, useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'

interface AccessLog {
  id: string
  action: string
  ipAddress: string | null
  createdAt: string
  user: {
    email: string
    role: string
  } | null
}

const ACTION_LABELS: Record<string, string> = {
  VIEW_RECORD: 'Viewed Record',
  VERIFY_PRESCRIPTION: 'Verified Prescription',
  DISPENSE_PRESCRIPTION: 'Dispensed Prescription',
  REJECT_PRESCRIPTION: 'Rejected Prescription',
}

const ROLE_COLORS: Record<string, string> = {
  doctor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pharmacist: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  superadmin: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const columns: ColumnDef<AccessLog, unknown>[] = [
  {
    accessorKey: 'user.email',
    id: 'who',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Who" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.user?.email ?? 'Unknown user'}
      </span>
    ),
  },
  {
    accessorKey: 'user.role',
    id: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.original.user?.role ?? 'unknown'
      return (
        <Badge
          className={`border-0 text-[11px] capitalize ${ROLE_COLORS[role] ?? 'bg-muted text-muted-foreground'}`}
        >
          {role}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'action',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Action" />
    ),
    cell: ({ row }) => (
      <span>{ACTION_LABELS[row.original.action] ?? row.original.action}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
  },
  {
    accessorKey: 'ipAddress',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="IP Address" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.ipAddress ?? '-'}
      </span>
    ),
  },
]

export default function PatientAccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/patient/access-logs')
      if (!res.ok) throw new Error('Failed to load access logs')
      setLogs(await res.json())
    } catch {
      setError('Unable to load access logs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Eye className="size-5" />
          Access Logs
        </h2>
        <p className="text-sm text-muted-foreground">
          See who has accessed your medical records
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Eye className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No access logs yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No one has accessed your records yet.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          searchKey="who"
          searchPlaceholder="Search by email..."
        />
      )}
    </div>
  )
}

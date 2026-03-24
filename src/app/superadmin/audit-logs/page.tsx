'use client'

import { useCallback, useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CalendarIcon, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DataTable,
  DataTableColumnHeader,
} from '@/components/data-table'

interface AuditLog {
  id: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  createdAt: string
  user: {
    email: string
    institution?: {
      name: string
    } | null
  }
}

interface Institution {
  id: string
  name: string
  type: string
}

const ACTION_TYPES = [
  'APPROVE_CONSENT',
  'REJECT_CONSENT',
  'GRANT_CONSENT',
  'REVOKE_CONSENT',
  'CANCEL_CONSENT',
  'REGISTER_DOCTOR',
  'CREATE_PATIENT',
  'SELECT_RECORD',
  'UPLOAD_RECORD',
  'VIEW_PATIENT',
  'VIEW_RECORD',
  'VERIFY_PRESCRIPTION',
]

function getActionBadge(action: string) {
  const lower = action.toLowerCase()
  if (lower.includes('approve') || lower.includes('grant')) {
    return (
      <Badge
        variant="default"
        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 font-mono text-[11px]"
      >
        {action}
      </Badge>
    )
  }
  if (lower.includes('reject') || lower.includes('revoke') || lower.includes('cancel')) {
    return (
      <Badge
        variant="default"
        className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 font-mono text-[11px]"
      >
        {action}
      </Badge>
    )
  }
  if (lower.includes('upload') || lower.includes('create') || lower.includes('register') || lower.includes('select')) {
    return (
      <Badge
        variant="default"
        className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 font-mono text-[11px]"
      >
        {action}
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="bg-muted text-muted-foreground border-0 font-mono text-[11px]"
    >
      {action}
    </Badge>
  )
}

const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: 'action',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Action" />
    ),
    cell: ({ row }) => getActionBadge(row.getValue('action')),
  },
  {
    id: 'userEmail',
    accessorFn: (row) => row.user.email,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.user.email}</span>
    ),
  },
  {
    id: 'institution',
    accessorFn: (row) => row.user.institution?.name ?? 'System',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Institution" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.user?.institution?.name ?? 'System'}
      </span>
    ),
  },
  {
    accessorKey: 'resourceType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Resource Type" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.getValue('resourceType')}</span>
    ),
  },
  {
    accessorKey: 'resourceId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Resource ID" />
    ),
    cell: ({ row }) => {
      const id = row.getValue('resourceId') as string
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {id && id.length > 8 ? `${id.slice(0, 8)}...` : id}
        </span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.getValue('createdAt') as string).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    ),
  },
]

export default function SuperadminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [actionFilter, setActionFilter] = useState<string>('')
  const [institutionFilter, setInstitutionFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()

  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    fetch('/api/superadmin/institutions')
      .then((res) => res.json())
      .then((data) => setInstitutions(Array.isArray(data) ? data : data.institutions ?? []))
      .catch(() => {})
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (institutionFilter) params.set('institutionId', institutionFilter)
      if (fromDate) params.set('from', format(fromDate, 'yyyy-MM-dd'))
      if (toDate) params.set('to', format(toDate, 'yyyy-MM-dd'))

      const qs = params.toString()
      const res = await fetch(`/api/superadmin/audit-logs${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error('Failed to load audit logs')
      const data: AuditLog[] = await res.json()
      setLogs(data)
    } catch {
      setFetchError('Unable to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, institutionFilter, fromDate, toDate])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{fetchError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">System Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Platform-wide history of all system actions
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Action
          </span>
          <Select
            value={actionFilter}
            onValueChange={(value) => setActionFilter(value === '__all__' ? '' : (value ?? ''))}
          >
            <SelectTrigger className="h-9 w-52 text-sm">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All actions</SelectItem>
              {ACTION_TYPES.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Institution
          </span>
          <Select
            value={institutionFilter}
            onValueChange={(value) => setInstitutionFilter(value === '__all__' ? '' : (value ?? ''))}
          >
            <SelectTrigger className="h-9 w-52 text-sm">
              <SelectValue placeholder="All institutions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All institutions</SelectItem>
              {institutions.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            From
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  data-empty={!fromDate}
                  className="h-9 w-44 justify-start text-left text-sm font-normal data-[empty=true]:text-muted-foreground"
                />
              }
            >
              <CalendarIcon className="size-3.5" />
              {fromDate ? format(fromDate, 'MMM d, yyyy') : 'Pick a date'}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={setFromDate}
                disabled={(date) => (toDate ? date > toDate : false)}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            To
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  data-empty={!toDate}
                  className="h-9 w-44 justify-start text-left text-sm font-normal data-[empty=true]:text-muted-foreground"
                />
              }
            >
              <CalendarIcon className="size-3.5" />
              {toDate ? format(toDate, 'MMM d, yyyy') : 'Pick a date'}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={setToDate}
                disabled={(date) => (fromDate ? date < fromDate : false)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {(actionFilter || institutionFilter || fromDate || toDate) && (
          <div className="flex flex-col justify-end gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground opacity-0 select-none">
              &nbsp;
            </span>
            <button
              onClick={() => {
                setActionFilter('')
                setInstitutionFilter('')
                setFromDate(undefined)
                setToDate(undefined)
              }}
              className="h-9 rounded-lg px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No audit logs found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {actionFilter || institutionFilter || fromDate || toDate
              ? 'No logs match the current filters. Try adjusting or resetting them.'
              : 'No system actions have been recorded yet.'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          searchKey="userEmail"
          searchPlaceholder="Search by user email..."
        />
      )}
    </div>
  )
}

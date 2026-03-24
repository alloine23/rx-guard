'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Package,
  ClipboardCheck,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTableColumnHeader,
} from '@/components/data-table'

interface VerificationRow {
  id: string
  recordId: string
  recordType: string
  patientCode: string
  patientName: string
  status: 'verified' | 'dispensed' | 'rejected'
  verifiedAt: string
  dispensedAt: string | null
  rejectionReason: string | null
}

const STATUS_OPTIONS = [
  { label: 'Verified', value: 'verified', icon: CheckCircle2 },
  { label: 'Dispensed', value: 'dispensed', icon: Package },
  { label: 'Rejected', value: 'rejected', icon: XCircle },
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'verified':
      return (
        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[11px]">
          <CheckCircle2 className="mr-1 size-3" />
          Verified
        </Badge>
      )
    case 'dispensed':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[11px]">
          <Package className="mr-1 size-3" />
          Dispensed
        </Badge>
      )
    case 'rejected':
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[11px]">
          <XCircle className="mr-1 size-3" />
          Rejected
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const columns: ColumnDef<VerificationRow>[] = [
  {
    accessorKey: 'patientCode',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Patient Code" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue('patientCode')}</span>
    ),
  },
  {
    accessorKey: 'patientName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Patient Name" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue('patientName')}</span>
    ),
  },
  {
    accessorKey: 'recordType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Record Type" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue('recordType')}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => getStatusBadge(row.getValue('status')),
    filterFn: (row, id, value) => (value as string[]).includes(row.getValue(id)),
  },
  {
    accessorKey: 'verifiedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Verified" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.getValue('verifiedAt') as string).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
  {
    accessorKey: 'dispensedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dispensed" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('dispensedAt') as string | null
      return date ? (
        <span className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">{'\u2014'}</span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Link href={`/pharmacist/records/${row.original.recordId}`}>
        <Button variant="outline" size="sm">
          View
        </Button>
      </Link>
    ),
  },
]

export default function PharmacistVerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    fetch('/api/pharmacist/verifications?limit=200')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load verifications')
        const json = await res.json()
        setVerifications(json.data)
      })
      .catch(() => setFetchError('Unable to load verifications.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-72 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
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
        <h2 className="text-lg font-semibold tracking-tight">Verification History</h2>
        <p className="text-sm text-muted-foreground">
          All prescription verifications for your pharmacy
        </p>
      </div>

      {verifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No verifications yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No prescriptions have been verified yet.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={verifications}
          searchKey="patientCode"
          searchPlaceholder="Search by patient code..."
          filters={[
            {
              columnId: 'status',
              title: 'Status',
              options: STATUS_OPTIONS,
            },
          ]}
        />
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClipboardList, ShieldCheck } from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTableColumnHeader,
} from '@/components/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Consent {
  id: string
  patientId: string
  hospitalId: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  grantedAt: string | null
  revokedAt: string | null
  createdAt: string
  patient: {
    patientCode: string
    fullName: string
  }
}

interface Patient {
  id: string
  patientCode: string
  fullName: string
}

function getStatusBadge(status: Consent['status']) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="default" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
          Pending
        </Badge>
      )
    case 'approved':
      return (
        <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
          Approved
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="default" className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
          Rejected
        </Badge>
      )
    case 'revoked':
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">
          Revoked
        </Badge>
      )
    default:
      return null
  }
}

const columns: ColumnDef<Consent>[] = [
  {
    id: 'patientCode',
    accessorFn: (row) => row.patient.patientCode,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Patient Code" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm text-teal-600 dark:text-teal-400">
        {row.original.patient.patientCode}
      </span>
    ),
  },
  {
    id: 'patientName',
    accessorFn: (row) => row.patient.fullName,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Patient Name" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original.patient.fullName}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => getStatusBadge(row.getValue('status')),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Requested" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.getValue('createdAt') as string).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
]

export default function DoctorConsentsPage() {
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchConsents = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/consents')
      if (!res.ok) throw new Error('Failed to load consents')
      const data: Consent[] = await res.json()
      setConsents(data)
    } catch {
      sileo.error({ title: 'Failed to load consents', description: 'Please refresh the page and try again.' })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true)
    try {
      const res = await fetch('/api/doctor/patients')
      if (!res.ok) throw new Error('Failed to load patients')
      const data = await res.json()
      setPatients(data.patients ?? data)
    } catch {
      sileo.error({ title: 'Failed to load patients', description: 'Please try again.' })
    } finally {
      setLoadingPatients(false)
    }
  }, [])

  useEffect(() => {
    fetchConsents()
  }, [fetchConsents])

  function handleDialogOpen(open: boolean) {
    setDialogOpen(open)
    if (open && patients.length === 0) {
      fetchPatients()
    }
    if (!open) {
      setSelectedPatientId('')
    }
  }

  async function handleSubmitConsent() {
    if (!selectedPatientId) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/doctor/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        sileo.error({ title: 'Failed to submit consent', description: data.error ?? 'An unexpected error occurred.' })
        return
      }

      sileo.success({ title: 'Consent submitted', description: 'The consent request has been submitted for admin approval.' })
      setDialogOpen(false)
      setSelectedPatientId('')
      await fetchConsents()
    } catch {
      sileo.error({ title: 'Network error', description: 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Patient Consents</h2>
            <p className="text-sm text-muted-foreground">
              Submit and track consent requests for your patients
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>Submit Consent</DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Consent for Patient</DialogTitle>
              <DialogDescription>
                Select a patient to submit a consent request to your hospital for admin approval.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Patient
              </label>
              {loadingPatients ? (
                <Skeleton className="h-9 w-full rounded-lg" />
              ) : (
                <Select value={selectedPatientId} onValueChange={(v) => setSelectedPatientId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.fullName} ({p.patientCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmitConsent} disabled={!selectedPatientId || submitting}>
                {submitting ? 'Submitting...' : 'Submit Consent'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {consents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No consents yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No consent requests have been submitted for your patients. Click &quot;Submit Consent&quot; to get started.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={consents}
          searchKey="patientName"
          searchPlaceholder="Search by patient name..."
        />
      )}
    </div>
  )
}

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
  getSelectionColumn,
} from '@/components/data-table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'

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

type ConsentAction = 'approve' | 'reject'

interface PendingAction {
  consent: Consent
  action: ConsentAction
}

interface BulkAction {
  action: ConsentAction
  count: number
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

function buildColumns(
  onAction: (consent: Consent, action: ConsentAction) => void,
  showActions: boolean,
  showSelection: boolean
): ColumnDef<Consent>[] {
  const cols: ColumnDef<Consent>[] = []

  if (showSelection) {
    cols.push(getSelectionColumn<Consent>())
  }

  cols.push(
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
      filterFn: (row, id, value) => {
        return (value as string[]).includes(row.getValue(id))
      },
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
  )

  if (showActions) {
    cols.push({
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      header: () => (
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Actions
        </div>
      ),
      cell: ({ row }) => {
        const consent = row.original
        if (consent.status !== 'pending') return null
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              onClick={() => onAction(consent, 'approve')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              onClick={() => onAction(consent, 'reject')}
            >
              Reject
            </Button>
          </div>
        )
      },
    })
  }

  return cols
}

const statusFilterOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Revoked', value: 'revoked' },
]

export default function AdminConsentsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [pendingConsents, setPendingConsents] = useState<Consent[]>([])
  const [allConsents, setAllConsents] = useState<Consent[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Consent[]>([])

  const fetchPending = useCallback(async () => {
    try {
      setFetchError('')
      const res = await fetch('/api/admin/consents?status=pending')
      if (!res.ok) throw new Error('Failed to load pending consents')
      const data: Consent[] = await res.json()
      setPendingConsents(data)
    } catch {
      setFetchError('Unable to load pending consents.')
    } finally {
      setLoadingPending(false)
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoadingAll(true)
    try {
      setFetchError('')
      const res = await fetch('/api/admin/consents?status=all')
      if (!res.ok) throw new Error('Failed to load consents')
      const data: Consent[] = await res.json()
      setAllConsents(data)
    } catch {
      setFetchError('Unable to load consents.')
    } finally {
      setLoadingAll(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  function handleTabChange(value: string | null) {
    if (value === 'pending' || value === 'all') {
      setActiveTab(value)
      if (value === 'all' && allConsents.length === 0 && !loadingAll) {
        fetchAll()
      }
    }
  }

  function openActionDialog(consent: Consent, action: ConsentAction) {
    setPendingAction({ consent, action })
  }

  async function handleConfirmAction() {
    if (!pendingAction) return
    setSubmitting(true)

    const { consent, action } = pendingAction

    try {
      const res = await fetch(`/api/admin/consents/${consent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        sileo.error({
          title: action === 'approve' ? 'Failed to approve consent' : 'Failed to reject consent',
          description: data.error ?? 'An unexpected error occurred.',
        })
        setSubmitting(false)
        setPendingAction(null)
        return
      }

      sileo.success({
        title: action === 'approve' ? 'Consent approved' : 'Consent rejected',
        description:
          action === 'approve'
            ? `${consent.patient.fullName}'s consent has been approved.`
            : `${consent.patient.fullName}'s consent has been rejected.`,
      })

      setPendingAction(null)
      setSubmitting(false)

      // Refresh both lists
      fetchPending()
      if (allConsents.length > 0) {
        fetchAll()
      }
    } catch {
      sileo.error({ title: 'Network error', description: 'Please try again.' })
      setSubmitting(false)
      setPendingAction(null)
    }
  }

  function openBulkDialog(action: ConsentAction) {
    const pendingSelected = selectedRows.filter((c) => c.status === 'pending')
    if (pendingSelected.length === 0) {
      sileo.error({ title: 'No pending consents selected', description: 'Only pending consents can be approved or rejected.' })
      return
    }
    setBulkAction({ action, count: pendingSelected.length })
  }

  async function handleConfirmBulkAction() {
    if (!bulkAction) return
    setSubmitting(true)

    const pendingIds = selectedRows
      .filter((c) => c.status === 'pending')
      .map((c) => c.id)

    try {
      const res = await fetch('/api/admin/consents/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingIds, action: bulkAction.action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        sileo.error({
          title: bulkAction.action === 'approve'
            ? 'Failed to approve consents'
            : 'Failed to reject consents',
          description: data.error ?? 'An unexpected error occurred.',
        })
        setSubmitting(false)
        setBulkAction(null)
        return
      }

      const result = await res.json()
      const actionText = bulkAction.action === 'approve' ? 'approved' : 'rejected'
      sileo.success({ title: `${result.updated} consent(s) ${actionText}`, description: `Successfully ${actionText} ${result.updated} consent request(s).` })

      setBulkAction(null)
      setSubmitting(false)
      setSelectedRows([])

      // Refresh both lists
      fetchPending()
      if (allConsents.length > 0) {
        fetchAll()
      }
    } catch {
      sileo.error({ title: 'Network error', description: 'Please try again.' })
      setSubmitting(false)
      setBulkAction(null)
    }
  }

  const pendingColumns = buildColumns(openActionDialog, true, true)
  const allColumns = buildColumns(openActionDialog, true, false)

  if (loadingPending) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-lg" />
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

  if (fetchError && !loadingPending && !loadingAll) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{fetchError}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Consents</h2>
            <p className="text-sm text-muted-foreground">
              Manage patient consent requests
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList variant="line" className="h-10 gap-0 border-b border-border/50 px-0">
            <TabsTrigger value="pending" className="px-4 py-2 text-sm">
              Pending
              {pendingConsents.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                >
                  {pendingConsents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="px-4 py-2 text-sm">
              All Consents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pendingConsents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <ClipboardList className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">No pending consents</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  All consent requests have been reviewed. New requests will appear here.
                </p>
              </div>
            ) : (
              <DataTable
                columns={pendingColumns}
                data={pendingConsents}
                searchKey="patientName"
                searchPlaceholder="Search by patient name..."
                onSelectedRowsChange={setSelectedRows}
              />
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {loadingAll ? (
              <div className="rounded-xl border border-border/50 bg-card">
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            ) : allConsents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <ClipboardList className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">No consents found</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  No consent records exist yet.
                </p>
              </div>
            ) : (
              <DataTable
                columns={allColumns}
                data={allConsents}
                searchKey="patientName"
                searchPlaceholder="Search by patient name..."
                filters={[
                  {
                    columnId: 'status',
                    title: 'Status',
                    options: statusFilterOptions,
                  },
                ]}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk action floating bar */}
      {selectedRows.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedRows.length}</span> consent(s) selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
            onClick={() => openBulkDialog('approve')}
          >
            Approve All
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 rounded-lg border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:text-red-300"
            onClick={() => openBulkDialog('reject')}
          >
            Reject All
          </Button>
        </div>
      )}

      {/* Single consent confirmation AlertDialog */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open && !submitting) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === 'approve'
                ? 'Approve Consent'
                : 'Reject Consent'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === 'approve'
                ? `Are you sure you want to approve the consent request from ${pendingAction?.consent.patient.fullName}? They will gain access to this hospital's medical record services.`
                : `Are you sure you want to reject the consent request from ${pendingAction?.consent.patient.fullName}? This action can be reviewed later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={submitting}
              className={
                pendingAction?.action === 'approve'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {submitting
                ? pendingAction?.action === 'approve'
                  ? 'Approving...'
                  : 'Rejecting...'
                : pendingAction?.action === 'approve'
                  ? 'Approve'
                  : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk action confirmation AlertDialog */}
      <AlertDialog
        open={!!bulkAction}
        onOpenChange={(open) => {
          if (!open && !submitting) setBulkAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction?.action === 'approve'
                ? 'Approve Selected Consents'
                : 'Reject Selected Consents'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction?.action === 'approve'
                ? `Are you sure you want to approve ${bulkAction?.count} pending consent request(s)? These patients will gain access to hospital medical record services.`
                : `Are you sure you want to reject ${bulkAction?.count} pending consent request(s)? This action can be reviewed later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkAction}
              disabled={submitting}
              className={
                bulkAction?.action === 'approve'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {submitting
                ? bulkAction?.action === 'approve'
                  ? 'Approving...'
                  : 'Rejecting...'
                : bulkAction?.action === 'approve'
                  ? `Approve ${bulkAction?.count}`
                  : `Reject ${bulkAction?.count}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

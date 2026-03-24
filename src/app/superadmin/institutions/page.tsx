'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { type ColumnDef } from '@tanstack/react-table'
import { Building2, Plus, Eye, Trash2 } from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTableColumnHeader,
  getSelectionColumn,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Institution {
  id: string
  name: string
  type: 'hospital' | 'pharmacy'
  location: string | null
  credentialsUrl: string | null
  createdAt: string
  _count: {
    users: number
  }
}

const columns: ColumnDef<Institution>[] = [
  getSelectionColumn<Institution>(),
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue('type') as string
      return (
        <Badge
          variant={type === 'hospital' ? 'default' : 'secondary'}
          className={
            type === 'hospital'
              ? 'bg-primary/10 text-primary hover:bg-primary/15 border-0'
              : 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 border-0'
          }
        >
          {type === 'hospital' ? 'Hospital' : 'Pharmacy'}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: '_count.users',
    id: 'users',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Users" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original._count.users}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {new Date(row.getValue('createdAt') as string).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Action</div>,
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  render={<Link href={`/superadmin/institutions/${row.original.id}`} />}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                />
              }
            >
              <Eye className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>View institution</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
  },
]

const typeFilterOptions = [
  { label: 'Hospital', value: 'hospital' },
  { label: 'Pharmacy', value: 'pharmacy' },
]

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [selectedRows, setSelectedRows] = useState<Institution[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchInstitutions = useCallback(async () => {
    try {
      setError('')
      const res = await fetch('/api/admin/institutions')
      if (!res.ok) throw new Error('Failed to fetch institutions')
      const data = await res.json()
      setInstitutions(data)
    } catch {
      setError('Unable to load institutions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInstitutions()
  }, [fetchInstitutions])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get('name') as string,
      type: form.get('type') as string,
      location: (form.get('location') as string) || undefined,
      credentialsUrl: (form.get('credentialsUrl') as string) || undefined,
    }

    try {
      const res = await fetch('/api/admin/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create institution')
      }

      setDialogOpen(false)
      sileo.success({ title: 'Institution created', description: `${body.name} has been added to the system.` })
      setLoading(true)
      await fetchInstitutions()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulkDelete() {
    setDeleting(true)
    const ids = selectedRows.map((r) => r.id)
    const count = ids.length

    try {
      await sileo.promise(
        fetch('/api/admin/institutions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        }).then((res) => {
          if (!res.ok) throw new Error('Failed to delete')
          return res.json()
        }),
        {
          loading: { title: `Deleting ${count} institution(s)...` },
          success: { title: `${count} institution(s) deleted` },
          error: { title: 'Failed to delete institutions', description: 'Please try again later.' },
        },
      )

      setDeleteDialogOpen(false)
      setSelectedRows([])
      setLoading(true)
      await fetchInstitutions()
    } catch {
      // Error already shown by sileo.promise
    } finally {
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Institutions</h2>
          <p className="text-sm text-muted-foreground">
            Manage hospitals and pharmacies in the system
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Institution
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Institution</DialogTitle>
              <DialogDescription>
                Add a new hospital or pharmacy to the system.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="inst-name"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Name
                </Label>
                <Input
                  id="inst-name"
                  name="name"
                  required
                  placeholder="Institution name"
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="inst-type"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Type
                </Label>
                <Select name="type" required defaultValue="hospital">
                  <SelectTrigger className="h-10 w-full rounded-lg bg-muted/40 px-3 text-sm focus-visible:bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="inst-location"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Location
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">(optional)</span>
                </Label>
                <Input
                  id="inst-location"
                  name="location"
                  placeholder="City, Province"
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="inst-credentials"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Credentials URL
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">(optional)</span>
                </Label>
                <Input
                  id="inst-credentials"
                  name="credentialsUrl"
                  type="url"
                  placeholder="https://..."
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              {formError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  {formError}
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Institution'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : institutions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No institutions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first hospital or pharmacy to get started.
          </p>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={institutions}
            searchKey="name"
            searchPlaceholder="Search institutions..."
            filters={[
              {
                columnId: 'type',
                title: 'Type',
                options: typeFilterOptions,
              },
            ]}
            onSelectedRowsChange={setSelectedRows}
          />

          {selectedRows.length > 0 && (
            <div className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedRows.length}</span> selected
              </span>
              <span className="h-4 w-px bg-border" />
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          )}

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedRows.length} institution(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  selected institutions and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}

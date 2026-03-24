'use client'

import { useCallback, useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus, Stethoscope, Trash2, UserX } from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTableColumnHeader,
} from '@/components/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

interface Doctor {
  id: string
  email: string
  isActive: boolean
  createdAt: string
}

const statusFilterOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  const fetchDoctors = useCallback(async () => {
    try {
      setFetchError('')
      const res = await fetch('/api/admin/doctors')
      if (!res.ok) throw new Error('Failed to load doctors')
      const data: Doctor[] = await res.json()
      setDoctors(data)
    } catch {
      setFetchError('Unable to load doctors list.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDoctors()
  }, [fetchDoctors])

  function resetForm() {
    setEmail('')
    setPassword('')
    setFormError('')
    setSubmitting(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/admin/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          setFormError('This email address is already in use.')
        } else if (data.details?.fieldErrors) {
          const errors = Object.values(data.details.fieldErrors).flat()
          setFormError((errors as string[]).join(' '))
        } else {
          setFormError(data.error || 'An unexpected error occurred.')
        }
        setSubmitting(false)
        return
      }

      setDialogOpen(false)
      resetForm()
      sileo.success({ title: 'Doctor registered', description: `${email} has been added to your institution.` })
      await fetchDoctors()
    } catch {
      setFormError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setDeleteLoading(target.id)

    // Optimistic remove
    setDoctors((prev) => prev.filter((d) => d.id !== target.id))

    try {
      const res = await fetch(`/api/admin/doctors/${target.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        // Revert
        setDoctors((prev) => [...prev, target].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ))
        const body = await res.json().catch(() => ({}))
        sileo.error({ title: 'Failed to delete doctor', description: body.error ?? 'Please try again.' })
        return
      }
      sileo.success({ title: 'Doctor removed', description: `${target.email} has been deleted.` })
    } catch {
      setDoctors((prev) => [...prev, target].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ))
      sileo.error({ title: 'Network error', description: 'Please check your connection and try again.' })
    } finally {
      setDeleteLoading(null)
    }
  }

  const columns: ColumnDef<Doctor>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
            <Stethoscope className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium">{row.getValue('email')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('isActive') as boolean
        return isActive ? (
          <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">
            Inactive
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        const isActive = row.getValue(id) as boolean
        const label = isActive ? 'active' : 'inactive'
        return value.includes(label)
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Registered" />
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
    {
      id: 'actions',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Action" />
      ),
      cell: ({ row }) => {
        const doctor = row.original
        const isLoading = deleteLoading === doctor.id
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
                    disabled={isLoading}
                    onClick={() => setDeleteTarget(doctor)}
                  />
                }
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent>Delete doctor</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Doctors</h2>
          <p className="text-sm text-muted-foreground">
            {doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'} registered
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Register Doctor
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Register New Doctor</DialogTitle>
              <DialogDescription>
                Create credentials for a new doctor in your institution.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="doctor-email"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="doctor-email"
                  type="email"
                  placeholder="doctor@hospital.ph"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="doctor-password"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="doctor-password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              {formError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  {formError}
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Registering...
                    </span>
                  ) : (
                    'Register Doctor'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {doctors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <UserX className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No doctors registered</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Get started by registering a doctor to your institution using the button above.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={doctors}
          searchKey="email"
          searchPlaceholder="Search by email..."
          filters={[
            {
              columnId: 'isActive',
              title: 'Status',
              options: statusFilterOptions,
            },
          ]}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete doctor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{deleteTarget?.email}</span> from the system.
              This can only succeed if the doctor has no registered patients or medical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

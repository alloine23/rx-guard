'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import { UserPlus, Eye, ClipboardCheck, Users, CalendarIcon } from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DataTable,
  DataTableColumnHeader,
  getSelectionColumn,
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

interface Patient {
  id: string
  patientCode: string
  fullName: string
  dateOfBirth: string
  createdAt: string
}

interface CreateResult {
  id: string
  patientCode: string
  email: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const columns: ColumnDef<Patient>[] = [
  getSelectionColumn<Patient>(),
  {
    accessorKey: 'patientCode',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Patient Code" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs font-medium text-primary">
        {row.getValue('patientCode')}
      </span>
    ),
  },
  {
    accessorKey: 'fullName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Full Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue('fullName')}</span>
    ),
  },
  {
    accessorKey: 'dateOfBirth',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date of Birth" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.getValue('dateOfBirth'))}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registered" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.getValue('createdAt'))}
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
                  render={<Link href={`/doctor/patients/${row.original.patientCode}`} />}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                />
              }
            >
              <Eye className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>View patient</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
  },
]

export default function DoctorPatientsPage() {
  const searchParams = useSearchParams()

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [registerOpen, setRegisterOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dob, setDob] = useState<Date | undefined>(undefined)

  const [successOpen, setSuccessOpen] = useState(false)
  const [createResult, setCreateResult] = useState<CreateResult | null>(null)

  const [selectedRows, setSelectedRows] = useState<Patient[]>([])

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/patients')
      if (!res.ok) throw new Error('Failed to fetch patients')
      const data = await res.json()
      setPatients(data)
    } catch {
      setError('Unable to load patients.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setRegisterOpen(true)
    }
  }, [searchParams])

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    const form = new FormData(e.currentTarget)
    if (!dob) {
      setFormError('Date of birth is required')
      setSubmitting(false)
      return
    }
    const body = {
      fullName: form.get('fullName') as string,
      email: form.get('email') as string,
      dateOfBirth: format(dob, 'yyyy-MM-dd'),
      phone: (form.get('phone') as string) || undefined,
    }

    try {
      const res = await fetch('/api/doctor/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.details?.fieldErrors) {
          const fieldMessages = Object.entries(data.details.fieldErrors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
            .join('. ')
          throw new Error(fieldMessages)
        }
        throw new Error(data.error || 'Failed to register patient')
      }

      const result: CreateResult = await res.json()
      setCreateResult(result)
      setRegisterOpen(false)
      setDob(undefined)
      setSuccessOpen(true)
      sileo.success({ title: 'Patient registered', description: `Patient code: ${result.patientCode}` })
      setLoading(true)
      fetchPatients()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Patients</h2>
          <p className="text-sm text-muted-foreground">
            Manage your registered patients
          </p>
        </div>
        <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
          <DialogTrigger
            render={
              <Button size="lg" className="h-9 gap-2 rounded-lg text-sm font-semibold" />
            }
          >
            <UserPlus className="h-4 w-4" />
            Register Patient
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Register New Patient</DialogTitle>
              <DialogDescription>
                Create a patient account. A temporary password will be emailed to the patient.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="fullName"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  placeholder="Juan Dela Cruz"
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="patient@email.com"
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Date of Birth
                </Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={`h-10 w-full justify-start rounded-lg bg-muted/40 px-3 text-left text-sm font-normal hover:bg-muted/60 ${
                          !dob ? 'text-muted-foreground/50' : ''
                        }`}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {dob ? format(dob, 'MMMM d, yyyy') : 'Pick a date'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dob}
                      onSelect={setDob}
                      captionLayout="dropdown"
                      defaultMonth={dob ?? new Date(2000, 0)}
                      fromYear={1920}
                      toYear={new Date().getFullYear()}
                      disabled={{ after: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Phone
                  <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+63 912 345 6789"
                  className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                />
              </div>
              {formError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  {formError}
                </div>
              )}
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-9 gap-2 rounded-lg text-sm font-semibold"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Registering...
                    </span>
                  ) : (
                    'Register Patient'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Patient Registered</DialogTitle>
            <DialogDescription>
              The patient account has been created successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-3 text-primary">
                <ClipboardCheck className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Patient Code
                  </p>
                  <p className="text-lg font-bold tracking-tight text-foreground">
                    {createResult?.patientCode}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A temporary password has been sent to{' '}
              <span className="font-medium text-foreground">{createResult?.email}</span>.
              The patient should log in and change their password immediately.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setSuccessOpen(false)}
              className="h-9 rounded-lg text-sm font-semibold"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No patients yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Register your first patient to get started.
          </p>
          <Button
            onClick={() => setRegisterOpen(true)}
            size="lg"
            className="mt-4 h-9 gap-2 rounded-lg text-sm font-semibold"
          >
            <UserPlus className="h-4 w-4" />
            Register Patient
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={patients}
            searchKey="fullName"
            searchPlaceholder="Search patients..."
            onSelectedRowsChange={setSelectedRows}
          />

          {selectedRows.length > 0 && (
            <div className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-4">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedRows.length}</span> patient(s) selected
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

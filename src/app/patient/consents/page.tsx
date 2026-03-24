'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, MapPin, RefreshCw, Search, Shield } from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/* ─────────── Types ─────────── */

interface Consent {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  createdAt: string
  grantedAt: string | null
  revokedAt: string | null
  expiresAt: string | null
  rejectionReason: string | null
  hospital: {
    id: string
    name: string
    location: string
  }
}

interface Hospital {
  id: string
  name: string
  location: string
}

/* ─────────── Status Badge ─────────── */

function StatusBadge({ status, expired }: { status: Consent['status']; expired?: boolean }) {
  if (status === 'approved' && expired) {
    return (
      <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
        Expired
      </Badge>
    )
  }
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
          Approved
        </Badge>
      )
    case 'pending':
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
          Pending
        </Badge>
      )
    case 'rejected':
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
          Rejected
        </Badge>
      )
    case 'revoked':
      return (
        <Badge className="bg-muted text-muted-foreground border-0">
          Revoked
        </Badge>
      )
  }
}

/* ─────────── Date Formatter ─────────── */

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/* ─────────── Skeleton ─────────── */

function ConsentCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

/* ─────────── Consent Card ─────────── */

function ConsentCard({
  consent,
  onAction,
  onRenew,
}: {
  consent: Consent
  onAction: (id: string, action: 'cancel' | 'revoke') => Promise<void>
  onRenew: (hospitalId: string) => Promise<void>
}) {
  const [acting, setActing] = useState(false)
  const [renewing, setRenewing] = useState(false)

  const isExpired =
    consent.status === 'approved' &&
    consent.expiresAt !== null &&
    new Date(consent.expiresAt) < new Date()

  async function handleAction(action: 'cancel' | 'revoke') {
    setActing(true)
    await onAction(consent.id, action)
    setActing(false)
  }

  async function handleRenew() {
    setRenewing(true)
    await onRenew(consent.hospital.id)
    setRenewing(false)
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {consent.hospital.name}
            </CardTitle>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{consent.hospital.location}</span>
            </div>
          </div>
          <StatusBadge status={consent.status} expired={isExpired} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>Requested: {formatDate(consent.createdAt)}</p>
            {consent.grantedAt && (
              <p>Approved: {formatDate(consent.grantedAt)}</p>
            )}
            {consent.revokedAt && (
              <p>Revoked: {formatDate(consent.revokedAt)}</p>
            )}
            {consent.expiresAt && (
              <p>Expires: {formatDate(consent.expiresAt)}</p>
            )}
            {consent.status === 'rejected' && consent.rejectionReason && (
              <p className="text-red-500 dark:text-red-400">
                Reason: {consent.rejectionReason}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex flex-col gap-2 items-end">
            {consent.status === 'pending' && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                    />
                  }
                >
                  Cancel
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Consent Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel your consent request to{' '}
                      <strong>{consent.hospital.name}</strong>? This request
                      will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={acting}>
                      Keep Request
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction('cancel')}
                      disabled={acting}
                      className="bg-amber-600 text-white hover:bg-amber-700"
                    >
                      {acting ? 'Cancelling...' : 'Cancel Request'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {consent.status === 'approved' && !isExpired && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    />
                  }
                >
                  Revoke
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke Consent</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to revoke your consent for{' '}
                      <strong>{consent.hospital.name}</strong>? They will no
                      longer be able to access your medical records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={acting}>
                      Keep Consent
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction('revoke')}
                      disabled={acting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {acting ? 'Revoking...' : 'Revoke Consent'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {(consent.status === 'revoked' ||
              consent.status === 'rejected' ||
              isExpired) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRenew}
                disabled={renewing}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                {renewing ? 'Renewing...' : 'Renew Consent'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─────────── Searchable Hospital Picker ─────────── */

function HospitalPicker({
  hospitals,
  loading,
  value,
  onChange,
}: {
  hospitals: Hospital[]
  loading: boolean
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = hospitals.find((p) => p.id === value)
  const filtered = hospitals.filter((p) => {
    if (!query) return true
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)
  })

  if (loading) return <Skeleton className="h-9 w-full rounded-lg" />

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setTimeout(() => inputRef.current?.focus(), 0)
        else setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
          />
        }
      >
        {selected ? (
          <span className="truncate">
            <span className="font-medium">{selected.name}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              — {selected.location}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Select a hospital...</span>
        )}
        <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-[280px] p-0" align="start">
        <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hospitals..."
            className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No hospitals found.
            </p>
          ) : (
            filtered.map((hospital) => (
              <button
                key={hospital.id}
                type="button"
                onClick={() => {
                  onChange(hospital.id)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Check
                  className={`size-4 shrink-0 transition-opacity ${value === hospital.id ? 'opacity-100 text-primary' : 'opacity-0'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{hospital.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{hospital.location}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ─────────── Grant Consent Dialog ─────────── */

function GrantConsentDialog({
  hospitals,
  loadingHospitals,
  onGrant,
}: {
  hospitals: Hospital[]
  loadingHospitals: boolean
  onGrant: (hospitalId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  async function handleGrant() {
    if (!selectedHospitalId) return
    setSubmitting(true)
    await onGrant(selectedHospitalId)
    setSubmitting(false)
    setOpen(false)
    setSelectedHospitalId('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!submitting) {
      setOpen(nextOpen)
      if (!nextOpen) setSelectedHospitalId('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>Grant Consent</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Consent to Hospital</DialogTitle>
          <DialogDescription>
            Select a hospital to grant access to your medical records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hospital
          </label>
          <HospitalPicker
            hospitals={hospitals}
            loading={loadingHospitals}
            value={selectedHospitalId}
            onChange={setSelectedHospitalId}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGrant}
            disabled={!selectedHospitalId || submitting}
          >
            {submitting ? 'Granting...' : 'Grant Consent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────── Page ─────────── */

export default function PatientConsentsPage() {
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loadingHospitals, setLoadingHospitals] = useState(true)

  const fetchConsents = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/consents')
      if (!res.ok) throw new Error('Failed to load consents')
      const data: Consent[] = await res.json()
      setConsents(data)
    } catch {
      sileo.error({ title: 'Failed to load consents', description: 'Please refresh the page and try again.' })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHospitals = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/hospitals')
      if (!res.ok) throw new Error('Failed to load hospitals')
      const data: Hospital[] = await res.json()
      setHospitals(data)
    } catch {
      sileo.error({ title: 'Failed to load hospitals', description: 'Please refresh the page and try again.' })
    } finally {
      setLoadingHospitals(false)
    }
  }, [])

  useEffect(() => {
    fetchConsents()
    fetchHospitals()
  }, [fetchConsents, fetchHospitals])

  async function handleGrant(hospitalId: string) {
    try {
      const res = await fetch('/api/patient/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        sileo.error({ title: 'Failed to grant consent', description: data.error ?? 'An unexpected error occurred.' })
        return
      }

      sileo.success({ title: 'Consent request sent', description: 'Your consent request has been submitted for approval.' })
      await fetchConsents()
    } catch {
      sileo.error({ title: 'Network error', description: 'Please try again.' })
    }
  }

  async function handleAction(id: string, action: 'cancel' | 'revoke') {
    try {
      const res = await fetch(`/api/patient/consents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        sileo.error({
          title: action === 'cancel' ? 'Failed to cancel request' : 'Failed to revoke consent',
          description: data.error ?? 'An unexpected error occurred.',
        })
        return
      }

      sileo.success({
        title: action === 'cancel' ? 'Request cancelled' : 'Consent revoked',
        description:
          action === 'cancel'
            ? 'Your consent request has been cancelled.'
            : 'Your consent has been revoked successfully.',
      })
      await fetchConsents()
    } catch {
      sileo.error({ title: 'Network error', description: 'Please try again.' })
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Consent Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Control which hospitals can access your medical records.
            </p>
          </div>
        </div>
        <GrantConsentDialog
          hospitals={hospitals}
          loadingHospitals={loadingHospitals}
          onGrant={handleGrant}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ConsentCardSkeleton key={i} />
          ))}
        </div>
      ) : consents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No consents yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            You have not granted consent to any hospital yet. Click &quot;Grant
            Consent&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {consents.map((consent) => (
            <ConsentCard
              key={consent.id}
              consent={consent}
              onAction={handleAction}
              onRenew={handleGrant}
            />
          ))}
        </div>
      )}
    </div>
  )
}

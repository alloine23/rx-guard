'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useBreadcrumbOverride } from '@/components/breadcrumb-context'
import Link from 'next/link'
import { sileo } from 'sileo'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Package,
  Loader2,
  Pill,
  FileText,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DynamicRecordView } from '@/components/dynamic-record-view'
import { ImageLightbox } from '@/components/image-lightbox'

interface Verification {
  id: string
  status: 'verified' | 'dispensed' | 'rejected'
  rejectionReason: string | null
  verifiedAt: string
  dispensedAt: string | null
}

interface RecordData {
  id: string
  recordType: string
  ocrStatus: string
  ocrData: Record<string, unknown>
  imageUrl: string | null
  createdAt: string
  verifications: Verification[]
  signatureStatus: 'unsigned' | 'signed'
  signedAt: string | null
  signedByName: string | null
  signatureValid: boolean | null
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return (
        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
          <CheckCircle2 className="mr-1 size-3" />
          Verified
        </Badge>
      )
    case 'dispensed':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
          <Package className="mr-1 size-3" />
          Dispensed
        </Badge>
      )
    case 'rejected':
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
          <XCircle className="mr-1 size-3" />
          Rejected
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function PharmacistRecordPage() {
  const { id } = useParams<{ id: string }>()
  const { setOverride } = useBreadcrumbOverride()
  const [record, setRecord] = useState<RecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  // Silent refetch — no loading skeleton flash
  const refetch = async () => {
    try {
      const res = await fetch(`/api/pharmacist/records/${id}`)
      if (res.ok) setRecord(await res.json())
    } catch { /* background refresh, ignore */ }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/pharmacist/records/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? `Error ${res.status}`)
          return
        }
        const data = await res.json()
        setRecord(data)
        setOverride(id, data.recordType?.replace(/_/g, ' ') ?? 'Record')
      })
      .catch(() => setError('Failed to load record'))
      .finally(() => setLoading(false))
  }, [id])

  const handleVerify = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/pharmacist/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        sileo.error({ title: body.error ?? 'Failed to verify' })
        return
      }
      sileo.success({ title: 'Prescription verified' })
      await refetch()
    } finally {
      setActionLoading(false)
    }
  }

  const handleDispense = async (verificationId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/pharmacist/verifications/${verificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispense' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        sileo.error({ title: body.error ?? 'Failed to dispense' })
        return
      }
      sileo.success({ title: 'Prescription marked as dispensed' })
      await refetch()
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (verificationId: string) => {
    if (!rejectionReason.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/pharmacist/verifications/${verificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason: rejectionReason.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        sileo.error({ title: body.error ?? 'Failed to reject' })
        return
      }
      sileo.success({ title: 'Prescription rejected' })
      setShowRejectForm(false)
      setRejectionReason('')
      await refetch()
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error && !record) {
    return (
      <div className="space-y-4">
        <Link href="/pharmacist/search">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Search
          </Button>
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  if (!record) return null

  const latestVerification = record.verifications[0] ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/pharmacist/search">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Search
          </Button>
        </Link>
        {latestVerification && <StatusBadge status={latestVerification.status} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Record image */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="border-b border-border/50 px-4 py-3 flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Record Image</span>
            <Badge variant="secondary" className="ml-auto border-0 text-[11px]">
              {record.recordType}
            </Badge>
          </div>
          {record.imageUrl ? (
            <div className="p-4">
              <ImageLightbox
                src={record.imageUrl}
                alt="Medical record"
                title={record.recordType || 'Medical Record'}
              >
                <img
                  src={record.imageUrl}
                  alt="Medical record"
                  className="w-full rounded-lg"
                />
              </ImageLightbox>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FileText className="size-10" />
              <p className="mt-2 text-sm">No image available</p>
            </div>
          )}
        </div>

        {/* Right: Extracted fields + verification */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/50 px-4 py-3 flex items-center gap-2">
              <Pill className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {typeof record.ocrData.record_type === 'string'
                  ? record.ocrData.record_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : 'Prescription Details'}
              </span>
            </div>
            <div className="p-4 space-y-4">
              {record.signatureStatus === 'signed' && (
                <div className="flex items-center gap-1.5">
                  {record.signatureValid ? (
                    <>
                      <ShieldCheck className="size-3.5 text-green-600" />
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Verified — signed by {record.signedByName}
                        {record.signedAt && ` on ${new Date(record.signedAt).toLocaleDateString()}`}
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="size-3.5 text-red-600" />
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Warning: Data modified after signing
                      </span>
                    </>
                  )}
                </div>
              )}

              {record.signatureStatus === 'unsigned' && (
                <Badge variant="outline" className="text-xs">Not Signed</Badge>
              )}

              <DynamicRecordView data={record.ocrData} />
            </div>
          </div>

          {/* Verification actions */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/50 px-4 py-3">
              <span className="text-sm font-medium">Verification</span>
            </div>
            <div className="p-4">
              {!latestVerification && (
                <Button onClick={handleVerify} disabled={actionLoading} className="w-full">
                  {actionLoading ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 size-4" />
                  )}
                  Verify Prescription
                </Button>
              )}

              {latestVerification?.status === 'verified' && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Verified on{' '}
                    {new Date(latestVerification.verifiedAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDispense(latestVerification.id)}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Package className="mr-1.5 size-4" />
                      )}
                      Mark as Dispensed
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectForm(true)}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      <XCircle className="mr-1.5 size-4" />
                      Reject
                    </Button>
                  </div>

                  {showRejectForm && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Textarea
                        placeholder="Reason for rejection..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(latestVerification.id)}
                          disabled={actionLoading || !rejectionReason.trim()}
                        >
                          Confirm Rejection
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowRejectForm(false)
                            setRejectionReason('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {latestVerification?.status === 'dispensed' && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                    <Package className="mr-1 size-3" />
                    Dispensed
                  </Badge>
                  <span className="text-muted-foreground">
                    on{' '}
                    {latestVerification.dispensedAt
                      ? new Date(latestVerification.dispensedAt).toLocaleDateString(
                          'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        )
                      : 'N/A'}
                  </span>
                </div>
              )}

              {latestVerification?.status === 'rejected' && (
                <div className="space-y-2">
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0">
                    <XCircle className="mr-1 size-3" />
                    Rejected
                  </Badge>
                  {latestVerification.rejectionReason && (
                    <p className="text-sm text-muted-foreground">
                      Reason: {latestVerification.rejectionReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

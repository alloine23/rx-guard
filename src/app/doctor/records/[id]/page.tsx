'use client'

import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useBreadcrumbOverride } from '@/components/breadcrumb-context'
import Image from 'next/image'
import {
  ArrowLeft,
  Check,
  Copy,
  Edit3,
  Loader2,
  X,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ImageLightbox } from '@/components/image-lightbox'
import { sileo } from 'sileo'
import QRCode from 'qrcode'
import { DynamicRecordView } from '@/components/dynamic-record-view'
import { DynamicRecordEditor } from '@/components/dynamic-record-editor'

interface Medication {
  name: string
  dosage: string
  frequency: string
}

interface OcrData {
  patient_name?: string
  date?: string
  diagnosis?: string
  medications?: Medication[]
  doctor_name?: string
  error?: string
}

interface RecordDetail {
  id: string
  patientCode: string
  patientName: string
  recordType: string | null
  ocrStatus: string
  ocrEngine: string | null
  ocrData: Record<string, unknown> | null
  ocrConfidence: number | null
  isDuplicate: boolean
  imageUrl: string | null
  createdAt: string
  signatureStatus: 'unsigned' | 'signed'
  signedAt: string | null
  signedDataHash: string | null
  verifyToken: string | null
}

const MAX_POLL_ATTEMPTS = 60

function TraditionalRecordView({
  data,
  editing,
  editData,
  setEditData,
  updateMedication,
  addMedication,
  removeMedication,
}: {
  data: OcrData
  editing: boolean
  editData: OcrData | null
  setEditData: (d: Record<string, unknown> | null) => void
  updateMedication: (index: number, field: keyof Medication, value: string) => void
  addMedication: () => void
  removeMedication: (index: number) => void
}) {
  const d = editing ? editData : data
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Patient Name
        </Label>
        {editing ? (
          <Input
            value={editData?.patient_name ?? ''}
            onChange={(e) => setEditData({ ...editData!, patient_name: e.target.value })}
          />
        ) : (
          <p className="text-sm font-medium">{data.patient_name || '—'}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Date
        </Label>
        {editing ? (
          <Input
            value={editData?.date ?? ''}
            onChange={(e) => setEditData({ ...editData!, date: e.target.value })}
          />
        ) : (
          <p className="text-sm">{data.date || '—'}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Diagnosis
        </Label>
        {editing ? (
          <Input
            value={editData?.diagnosis ?? ''}
            onChange={(e) => setEditData({ ...editData!, diagnosis: e.target.value })}
          />
        ) : (
          <p className="text-sm">{data.diagnosis || '—'}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Doctor Name
        </Label>
        {editing ? (
          <Input
            value={editData?.doctor_name ?? ''}
            onChange={(e) => setEditData({ ...editData!, doctor_name: e.target.value })}
          />
        ) : (
          <p className="text-sm">{data.doctor_name || '—'}</p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Medications
          </Label>
          {editing && (
            <Button variant="outline" size="sm" onClick={addMedication} className="h-7 gap-1.5 text-xs">
              <Plus className="size-3" />
              Add
            </Button>
          )}
        </div>

        {((d?.medications ?? []).length === 0) ? (
          <p className="text-sm text-muted-foreground">No medications extracted</p>
        ) : (
          <div className="space-y-3">
            {(d?.medications ?? []).map((med, idx) => (
              <div key={idx} className="rounded-lg border bg-muted/30 p-3">
                {editing ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeMedication(idx)} className="h-6 w-6 p-0 text-destructive">
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <Input placeholder="Medication name" value={med.name} onChange={(e) => updateMedication(idx, 'name', e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Dosage" value={med.dosage} onChange={(e) => updateMedication(idx, 'dosage', e.target.value)} />
                      <Input placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedication(idx, 'frequency', e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{med.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {med.dosage}{med.frequency && ` · ${med.frequency}`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const { setCustomBreadcrumbs } = useBreadcrumbOverride()

  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [signing, setSigning] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [pollGeneration, setPollGeneration] = useState(0)
  const pollCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/records/${id}`)
      if (res.status === 404) {
        setError('Record not found.')
        return null
      }
      if (!res.ok) throw new Error('Failed to fetch record')
      const data: RecordDetail = await res.json()
      setRecord(data)
      setCustomBreadcrumbs([
        { label: 'Patients', href: '/doctor/patients' },
        { label: data.patientName, href: `/doctor/patients/${data.patientCode}` },
        { label: data.recordType?.replace(/_/g, ' ') ?? 'Record', href: `/doctor/records/${id}` },
      ])
      setLoading(false)
      return data
    } catch {
      setError('Unable to load record details.')
      setLoading(false)
      return null
    }
  }, [id, setCustomBreadcrumbs])

  // Signal "loading" to breadcrumbs before browser paints
  useLayoutEffect(() => {
    setCustomBreadcrumbs([])
  }, [setCustomBreadcrumbs])

  useEffect(() => {
    let active = true

    async function init() {
      const data = await fetchRecord()
      if (!data || !active) return

      if (data.ocrStatus === 'pending' || data.ocrStatus === 'processing') {
        intervalRef.current = setInterval(async () => {
          pollCount.current += 1

          if (pollCount.current >= MAX_POLL_ATTEMPTS) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            setPollTimedOut(true)
            return
          }

          const updated = await fetchRecord()
          if (
            updated &&
            updated.ocrStatus !== 'pending' &&
            updated.ocrStatus !== 'processing'
          ) {
            if (intervalRef.current) clearInterval(intervalRef.current)
          }
        }, 2000)
      }
    }

    init()
    return () => {
      active = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      setCustomBreadcrumbs(null)
    }
  }, [fetchRecord, pollGeneration, setCustomBreadcrumbs])

  useEffect(() => {
    if (record?.signatureStatus === 'signed' && record.verifyToken) {
      const baseUrl = window.location.origin
      const verifyUrl = `${baseUrl}/verify/${id}?token=${record.verifyToken}`
      QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#0d9488', light: '#ffffff' },
      }).then(setQrDataUrl)
    }
  }, [record?.signatureStatus, record?.verifyToken, id])

  function startEditing() {
    if (!record?.ocrData) return
    setEditData(structuredClone(record.ocrData))
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setEditData(null)
  }

  async function saveCorrections() {
    if (!editData) return
    setSaving(true)

    try {
      const res = await fetch(`/api/doctor/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrData: editData }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Save failed')
      }

      sileo.success({ title: 'Corrections saved', description: 'OCR data has been updated.' })
      setEditing(false)
      await fetchRecord()
    } catch (err) {
      sileo.error({ title: 'Save failed', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function reprocessOcr() {
    setReprocessing(true)
    try {
      const res = await fetch(`/api/doctor/records/${id}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Reprocess failed')
      }
      sileo.info({ title: 'OCR re-processing started', description: 'This may take a few moments.' })
      // Reset poll state and start polling for results
      pollCount.current = 0
      setPollTimedOut(false)
      setPollGeneration((g) => g + 1)
      await fetchRecord()
    } catch (err) {
      sileo.error({ title: 'Reprocess failed', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setReprocessing(false)
    }
  }

  function updateMedication(index: number, field: keyof Medication, value: string) {
    if (!editData) return
    const ocrEdit = editData as OcrData
    const meds = [...(ocrEdit.medications ?? [])]
    meds[index] = { ...meds[index], [field]: value }
    setEditData({ ...editData, medications: meds })
  }

  function addMedication() {
    if (!editData) return
    const ocrEdit = editData as OcrData
    setEditData({
      ...editData,
      medications: [
        ...(ocrEdit.medications ?? []),
        { name: '', dosage: '', frequency: '' },
      ],
    })
  }

  function removeMedication(index: number) {
    if (!editData) return
    const ocrEdit = editData as OcrData
    const meds = (ocrEdit.medications ?? []).filter((_: Medication, i: number) => i !== index)
    setEditData({ ...editData, medications: meds })
  }

  async function handleSign() {
    setSigning(true)
    try {
      const res = await fetch(`/api/doctor/records/${id}/sign`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Signing failed')
      }
      sileo.success({ title: 'Prescription signed successfully' })
      await fetchRecord()
    } catch (err) {
      sileo.error({ title: err instanceof Error ? err.message : 'Signing failed' })
    } finally {
      setSigning(false)
    }
  }

  const backHref = record
    ? `/doctor/patients/${record.patientCode}`
    : '/doctor/patients'

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          render={<Link href="/doctor/patients" />}
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Patients
        </Button>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-36" />
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,_2fr)_5fr]">
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!record) return null

  const data = editing ? editData : record.ocrData
  const isProcessing =
    record.ocrStatus === 'pending' || record.ocrStatus === 'processing'

  return (
    <div className="space-y-6">
      <Button
        render={<Link href={backHref} />}
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Patient
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,_2fr)_5fr]">
        {/* Left: Image Viewer — narrower reference panel */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Record Image</CardTitle>
          </CardHeader>
          <CardContent>
            {record.imageUrl ? (
              <ImageLightbox
                src={record.imageUrl}
                alt="Medical record"
                title={record.recordType?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Medical Record'}
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={record.imageUrl}
                    alt="Medical record"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </ImageLightbox>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                No image available
              </div>
            )}
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Type</span>
                <span className="capitalize font-medium text-foreground">
                  {record.recordType?.replace(/_/g, ' ') ?? 'General'}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span>Uploaded</span>
                <span className="font-medium text-foreground">
                  {new Date(record.createdAt).toLocaleDateString()}
                </span>
              </div>
              {record.ocrEngine && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>Method</span>
                    <span className="font-medium text-foreground">
                      {record.ocrEngine === 'llm_direct' ? 'Smart' : record.ocrEngine === 'llm' ? 'Enhanced' : 'Standard'}
                    </span>
                  </div>
                </>
              )}
              {record.isDuplicate && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-[10px]">
                      <Copy className="size-2.5" />
                      Duplicate
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Extracted Data Panel — dominant space */}
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-sm">Extracted Data</CardTitle>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge
                    variant={
                      record.ocrStatus === 'done'
                        ? 'default'
                        : record.ocrStatus === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="capitalize"
                  >
                    {record.ocrStatus}
                  </Badge>
                  {record.ocrEngine && (
                    <span className="text-xs text-muted-foreground">
                      {record.ocrEngine === 'llm_direct' ? 'Smart extraction' : record.ocrEngine === 'llm' ? 'Enhanced scan' : 'Standard scan'}
                    </span>
                  )}
                  {record.ocrConfidence !== null && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Confidence: {Math.round(record.ocrConfidence * 100)}%
                    </span>
                  )}
                </div>
                {record.signatureStatus === 'signed' && (
                  <div className="flex items-center gap-2">
                    <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                      <ShieldCheck className="size-3" />
                      Signed
                    </Badge>
                    {record.signedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.signedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            {record.ocrStatus === 'done' && !editing && record.signatureStatus !== 'signed' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reprocessOcr}
                  disabled={reprocessing}
                  className="gap-1.5"
                >
                  {reprocessing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Re-process
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                  className="gap-1.5"
                >
                  <Edit3 className="size-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={handleSign}
                  disabled={signing}
                  className="gap-1.5"
                >
                  {signing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3.5" />
                  )}
                  Confirm & Sign
                </Button>
              </div>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="gap-1.5"
                >
                  <X className="size-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveCorrections}
                  disabled={saving}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Save
                </Button>
              </div>
            )}
            </div>
          </CardHeader>
          <CardContent>
            {isProcessing && !pollTimedOut && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium">
                  Processing medical record…
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  OCR extraction is in progress. This page updates
                  automatically.
                </p>
              </div>
            )}

            {isProcessing && pollTimedOut && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="size-8 text-yellow-500" />
                <p className="mt-4 text-sm font-medium">
                  Processing is taking longer than expected
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Please check back later.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    pollCount.current = 0
                    setPollTimedOut(false)
                    setPollGeneration((g) => g + 1)
                  }}
                >
                  Retry
                </Button>
              </div>
            )}

            {record.ocrStatus === 'failed' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="size-8 text-destructive" />
                <p className="mt-4 text-sm font-medium">
                  OCR processing failed
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(record.ocrData as OcrData)?.error ?? 'An unknown error occurred.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={reprocessOcr}
                  disabled={reprocessing}
                >
                  {reprocessing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Retry OCR
                </Button>
              </div>
            )}

            {record.ocrStatus === 'done' && data && (
              <>
                {record.ocrEngine === 'llm_direct' ? (
                  editing ? (
                    <DynamicRecordEditor
                      data={editData as Record<string, unknown>}
                      onChange={setEditData}
                    />
                  ) : (
                    <DynamicRecordView data={data} />
                  )
                ) : (
                  <TraditionalRecordView
                    data={data as OcrData}
                    editing={editing}
                    editData={editData as OcrData | null}
                    setEditData={setEditData}
                    updateMedication={updateMedication}
                    addMedication={addMedication}
                    removeMedication={removeMedication}
                  />
                )}
              </>
            )}

            {qrDataUrl && (
              <div className="mt-6 flex flex-col items-center gap-2 border-t pt-6">
                <p className="text-xs font-medium text-muted-foreground">Scan to verify prescription</p>
                <img src={qrDataUrl} alt="Verification QR code" className="size-40" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

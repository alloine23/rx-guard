'use client'

import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useBreadcrumbOverride } from '@/components/breadcrumb-context'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Upload,
  Eye,
  Loader2,
  ImagePlus,
  X,
  CheckCircle2,
  Copy,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { sileo } from 'sileo'
import { UploadProgress } from '@/components/upload-progress'

const RECORD_TYPES = [
  { value: 'prescription', label: 'Prescription' },
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'radiology', label: 'Radiology Report' },
  { value: 'consultation', label: 'Consultation Note' },
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'surgical_report', label: 'Surgical Report' },
  { value: 'other', label: 'Other' },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

interface MedicalRecord {
  id: string
  recordType: string | null
  ocrStatus: string
  ocrEngine: string | null
  ocrConfidence: number | null
  isDuplicate: boolean
  createdAt: string
}

interface PatientDetail {
  id: string
  patientCode: string
  fullName: string
  dateOfBirth: string
  phone: string | null
  email: string | null
  photoUrl: string | null
  createdAt: string
  records: MedicalRecord[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ocrStatusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'done':
      return 'default'
    case 'processing':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

const recordColumns: ColumnDef<MedicalRecord>[] = [
  {
    accessorKey: 'recordType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue<string | null>('recordType')
      return (
        <span className="text-sm font-medium capitalize">
          {type ? type.replace(/_/g, ' ').toLowerCase() : 'General'}
        </span>
      )
    },
  },
  {
    accessorKey: 'isDuplicate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const isDuplicate = row.getValue<boolean>('isDuplicate')
      if (!isDuplicate) return <span className="text-muted-foreground">—</span>
      return (
        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-[10px]">
          <Copy className="size-2.5" />
          Duplicate
        </Badge>
      )
    },
  },
  {
    accessorKey: 'ocrStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="OCR Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue<string>('ocrStatus')
      return (
        <Badge variant={ocrStatusVariant(status)} className="capitalize">
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'ocrConfidence',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Confidence" />
    ),
    cell: ({ row }) => {
      const confidence = row.getValue<number | null>('ocrConfidence')
      if (confidence === null) return <span className="text-muted-foreground">—</span>
      const pct = Math.round(confidence * 100)
      return (
        <span
          className={`tabular-nums text-sm font-medium ${
            pct >= 80 ? 'text-green-600 dark:text-green-400' : pct >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {pct}%
        </span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.getValue('createdAt'))}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Actions</span>,
    cell: ({ row }) => (
      <Button
        render={<Link href={`/doctor/records/${row.original.id}`} />}
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
      >
        <Eye className="size-3.5" />
        View
      </Button>
    ),
  },
]

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientCode: string }>
}) {
  const { patientCode } = React.use(params)
  const { setOverride, setCustomBreadcrumbs } = useBreadcrumbOverride()

  // Show skeleton breadcrumb while loading patient name
  useLayoutEffect(() => {
    setCustomBreadcrumbs([])
    return () => setCustomBreadcrumbs(null)
  }, [setCustomBreadcrumbs])

  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [useAiExtraction, setUseAiExtraction] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploadStage, setUploadStage] = useState<import('@/components/upload-progress').UploadStage>('idle')
  const [uploadError, setUploadError] = useState('')
  const [duplicateInfo, setDuplicateInfo] = useState<{ similarity: number; method: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPatient = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/patients/${patientCode}`)
      if (res.status === 404) {
        setError('Patient not found.')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch patient')
      const data = await res.json()
      setPatient(data)
      setOverride(patientCode, data.fullName)
      setCustomBreadcrumbs([
        { label: 'Patients', href: '/doctor/patients' },
        { label: data.fullName, href: `/doctor/patients/${patientCode}` },
      ])
    } catch {
      setError('Unable to load patient details.')
    } finally {
      setLoading(false)
    }
  }, [patientCode])

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  function handleFileSelect(file: File | null) {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      sileo.warning({ title: 'Invalid file type', description: 'Only JPEG and PNG images are accepted.' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      sileo.warning({ title: 'File too large', description: 'Maximum file size is 10MB.' })
      return
    }
    setUploadFile(file)
    const url = URL.createObjectURL(file)
    setUploadPreview(url)
  }

  function clearUploadFile() {
    setUploadFile(null)
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  async function handleUpload(allowDuplicate = false) {
    if (!uploadFile || !patient) return
    setUploading(true)
    setUploadError('')
    setDuplicateInfo(null)

    try {
      // Stage 1: Preparing
      setUploadStage('preparing')
      await new Promise((r) => setTimeout(r, 300)) // brief pause for visual feedback

      // Stage 2: Check for duplicates (skip if allowDuplicate)
      if (!allowDuplicate) {
        setUploadStage('checking')
        const checkForm = new FormData()
        checkForm.append('file', uploadFile)
        const checkRes = await fetch('/api/doctor/records/check-duplicate', {
          method: 'POST',
          body: checkForm,
        })
        if (checkRes.ok) {
          const checkData = await checkRes.json()
          if (checkData.duplicateDetected) {
            setDuplicateInfo({ similarity: checkData.similarity, method: checkData.method })
            setUploadStage('duplicate_found')
            setUploading(false)
            return
          }
        }
      }

      // Stage 3: Upload & process
      setUploadStage('uploading')
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('patientId', patient.id)
      if (uploadType && !useAiExtraction) formData.append('recordType', uploadType)
      if (useAiExtraction) formData.append('useAiExtraction', 'true')
      if (allowDuplicate) formData.append('allowDuplicate', 'true')

      const res = await fetch('/api/doctor/records', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      // Done
      setUploadStage('done')
      await new Promise((r) => setTimeout(r, 800)) // show success state briefly
      sileo.success({ title: 'Record uploaded', description: 'Processing has started.' })
      setUploadOpen(false)
      setDuplicateInfo(null)
      clearUploadFile()
      setUploadType('')
      setUseAiExtraction(false)
      setUploadStage('idle')
      await fetchPatient()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Please try again.')
      setUploadStage('error')
    } finally {
      setUploading(false)
    }
  }

  function resetUploadState() {
    setUploadStage('idle')
    setUploadError('')
    setDuplicateInfo(null)
  }

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
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!patient) return null

  return (
    <div className="space-y-6">
      <Button
        render={<Link href="/doctor/patients" />}
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Patients
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Patient Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Patient Code
              </p>
              <p className="font-mono text-sm font-medium text-primary">
                {patient.patientCode}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Full Name
              </p>
              <p className="text-sm font-medium">{patient.fullName}</p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Date of Birth
              </p>
              <p className="text-sm text-foreground">
                {formatDate(patient.dateOfBirth)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Phone className="h-3 w-3" />
                Phone
              </p>
              <p className="text-sm text-foreground">
                {patient.phone || (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3 w-3" />
                Email
              </p>
              <p className="text-sm text-foreground">
                {patient.email || (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Registered
              </p>
              <p className="text-sm text-foreground">
                {formatDate(patient.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Medical Records
          </CardTitle>
          <Dialog open={uploadOpen} onOpenChange={(open) => {
            if (!uploading) {
              setUploadOpen(open)
              if (!open) {
                clearUploadFile()
                setUploadType('')
                setUseAiExtraction(false)
                resetUploadState()
              }
            }
          }}>
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <Upload className="size-3.5" />
              Upload Record
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Medical Record</DialogTitle>
                <DialogDescription>
                  Upload a scanned medical record for OCR extraction. JPEG and PNG accepted, max 10MB.
                </DialogDescription>
              </DialogHeader>

              <div className="-mx-4 flex-1 space-y-4 overflow-y-auto px-4 py-2" ref={(el) => { if (el) el.scrollTop = 0 }}>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />

                {/* Drop zone / Preview */}
                {!uploadFile ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 ${
                      dragActive
                        ? 'border-primary bg-primary/5 shadow-[inset_0_0_20px_oklch(0.55_0.14_175/0.08)]'
                        : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center px-6 py-12">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200 ${
                          dragActive
                            ? 'bg-primary/15 text-primary scale-110'
                            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                        }`}
                      >
                        <ImagePlus className="h-7 w-7" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        {dragActive ? 'Drop your image here' : 'Drag & drop your image here'}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        or{' '}
                        <span className="font-medium text-primary underline underline-offset-2">
                          browse files
                        </span>
                      </p>
                      <p className="mt-3 text-[11px] text-muted-foreground/60">
                        JPEG or PNG up to 10MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
                    {/* Preview image — constrained height, scrollable content area handles the rest */}
                    <div className="relative w-full bg-black/5" style={{ height: 'min(240px, 30vh)' }}>
                      {uploadPreview && (
                        <Image
                          src={uploadPreview}
                          alt="Upload preview"
                          fill
                          className="object-contain p-2"
                          unoptimized
                        />
                      )}
                    </div>
                    {/* File info bar */}
                    <div className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-4 py-2.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="truncate text-xs font-medium">{uploadFile.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatFileSize(uploadFile.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearUploadFile()
                        }}
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        disabled={uploading}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* AI Extraction toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Smart Extraction
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically identify the record type and extract all fields
                    </p>
                  </div>
                  <Switch
                    checked={useAiExtraction}
                    onCheckedChange={setUseAiExtraction}
                  />
                </div>

                {/* Record type — hidden when AI extraction is on */}
                {!useAiExtraction && (
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Record Type
                      <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Select value={uploadType} onValueChange={(v) => setUploadType(v === '__none__' ? '' : (v ?? ''))}>
                      <SelectTrigger className="h-10 w-full rounded-lg bg-muted/40 px-3 text-sm focus-visible:bg-background">
                        <SelectValue placeholder="Select a type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No type specified</SelectItem>
                        {RECORD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Show stepper when uploading, footer when idle */}
              {uploadStage !== 'idle' ? (
                <div className="border-t px-1 pt-4">
                  <UploadProgress
                    stage={uploadStage}
                    error={uploadError}
                    duplicateInfo={duplicateInfo}
                    onConfirmDuplicate={() => handleUpload(true)}
                    onCancelDuplicate={() => {
                      resetUploadState()
                    }}
                    onRetry={() => {
                      resetUploadState()
                      handleUpload()
                    }}
                  />
                </div>
              ) : (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setUploadOpen(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleUpload()}
                    disabled={!uploadFile || uploading}
                    className="gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    Upload & Process
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {patient.records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">
                No medical records yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a medical record image to get started with OCR
                extraction.
              </p>
            </div>
          ) : (
            <DataTable
              columns={recordColumns}
              data={patient.records}
              searchKey="recordType"
              searchPlaceholder="Search records..."
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  Stethoscope,
  Calendar,
  Building2,
  AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DynamicRecordView } from '@/components/dynamic-record-view'
import { ImageLightbox } from '@/components/image-lightbox'

interface RecordDetail {
  id: string
  recordType: string
  ocrStatus: string
  ocrData: Record<string, unknown> | null
  ocrConfidence: number | null
  imageUrl: string | null
  createdAt: string
  institution: { name: string }
}

export default function PatientRecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRecord = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/patient/records/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Error ${res.status}`)
        return
      }
      setRecord(await res.json())
    } catch {
      setError('Failed to load record')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchRecord()
  }, [fetchRecord])

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

  if (error || !record) {
    return (
      <div className="space-y-4">
        <Link href="/patient/records">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Records
          </Button>
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error || 'Record not found'}</p>
        </div>
      </div>
    )
  }

  const ocrData = (record.ocrData ?? {}) as Record<string, unknown>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/patient/records">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Records
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="border-0 text-[11px]">
            {record.recordType || 'Unspecified'}
          </Badge>
          {record.ocrConfidence != null && (
            <Badge variant="secondary" className="border-0 text-[11px] tabular-nums">
              {Math.round(record.ocrConfidence * 100)}% confidence
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Record image */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="border-b border-border/50 px-4 py-3 flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Record Image</span>
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

        {/* Right: Extracted data */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {record.institution && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  {record.institution.name}
                </span>
              )}
              {typeof ocrData.doctor_name === 'string' && ocrData.doctor_name && (
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="size-3.5" />
                  {ocrData.doctor_name}
                </span>
              )}
              {typeof ocrData.date === 'string' && ocrData.date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  {ocrData.date}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Uploaded {new Date(record.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Record data — dynamic renderer for all record types */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/50 px-4 py-3 flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Extracted Data</span>
            </div>
            <div className="p-4">
              {record.ocrStatus === 'done' ? (
                <DynamicRecordView data={ocrData} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Data will appear once processing is complete.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

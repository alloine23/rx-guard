'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, FileText, Image, Loader2 } from 'lucide-react'
import { sileo } from 'sileo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface RecordRow {
  id: string
  recordType: string
  ocrStatus: string
  ocrConfidence: number | null
  createdAt: string
  institution: { name: string }
}

function getOcrBadge(status: string) {
  switch (status) {
    case 'done':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[11px]">
          Done
        </Badge>
      )
    case 'processing':
      return (
        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[11px]">
          <Loader2 className="mr-1 size-3 animate-spin" />
          Processing
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[11px]">
          Failed
        </Badge>
      )
    case 'pending':
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[11px]">
          Pending
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="border-0 text-[11px]">
          {status}
        </Badge>
      )
  }
}

export default function PatientRecordsPage() {
  const [records, setRecords] = useState<RecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/patient/records')
      if (!res.ok) throw new Error('Failed to load records')
      setRecords(await res.json())
    } catch {
      setError('Unable to load your medical records.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      await sileo.promise(
        fetch('/api/patient/records/export').then(async (res) => {
          if (!res.ok) throw new Error('Export failed')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'rxguard-records.zip'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }),
        {
          loading: { title: 'Preparing export...', description: 'Bundling your records into a ZIP file.' },
          success: { title: 'Records exported', description: 'Your download should start automatically.' },
          error: { title: 'Export failed', description: 'Please try again later.' },
        },
      )
    } catch {
      // Error already shown by sileo.promise
    } finally {
      setExporting(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Medical Records</h2>
          <p className="text-sm text-muted-foreground">
            Your digitized medical records and prescriptions
          </p>
        </div>
        {records.length > 0 && (
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {exporting ? 'Exporting...' : 'Export All'}
          </Button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No records yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Your medical records will appear here once your doctor uploads them.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">OCR Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Institution</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-3 font-medium">{record.recordType || 'Unspecified'}</td>
                  <td className="px-4 py-3">{getOcrBadge(record.ocrStatus)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.institution.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(record.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/patient/records/${record.id}`}>
                      <Button variant="outline" size="sm">
                        <Image className="mr-1 size-3.5" />
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

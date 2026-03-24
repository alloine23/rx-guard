'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  User,
  Calendar,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

interface PatientProfile {
  id: string
  patientCode: string
  fullName: string
  phone: string | null
  email: string | null
  dateOfBirth: string
  photoUrl: string | null
}

interface RecordSummary {
  id: string
  recordType: string
  ocrStatus: string
  createdAt: string
}

interface SearchResult {
  patient: PatientProfile
  records: RecordSummary[]
  hasConsent: boolean
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
          Processing
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[11px]">
          Failed
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

export default function PharmacistSearchPage() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prescriptionsOnly, setPrescriptionsOnly] = useState(true)

  const handleSearch = useCallback(async () => {
    const trimmed = code.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/pharmacist/patients/${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Error ${res.status}`)
        return
      }
      const data: SearchResult = await res.json()
      setResult(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [code])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Patient Search</h2>
        <p className="text-sm text-muted-foreground">
          Search by patient code to view their prescription records
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch()
        }}
        className="flex gap-3"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Enter patient code (e.g. RX-1234)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading || !code.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {result && (() => {
        const filteredRecords = prescriptionsOnly
          ? result.records.filter((r) => r.recordType === 'prescription')
          : result.records

        return (
        <div className="space-y-6">
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="size-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-base font-semibold">{result.patient.fullName}</h3>
                <p className="text-sm font-mono text-muted-foreground">
                  {result.patient.patientCode}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
                  {result.patient.dateOfBirth && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {new Date(result.patient.dateOfBirth).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {result.patient.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {result.patient.phone}
                    </span>
                  )}
                  {result.patient.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      {result.patient.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {result.hasConsent ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Medical Records ({filteredRecords.length}{prescriptionsOnly && result.records.length !== filteredRecords.length ? ` of ${result.records.length}` : ''})
                </h3>
                <div className="flex items-center gap-2.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="rx-filter">
                    Prescriptions only
                  </Label>
                  <Switch
                    id="rx-filter"
                    checked={prescriptionsOnly}
                    onCheckedChange={setPrescriptionsOnly}
                  />
                </div>
              </div>
              {filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-12 text-center">
                  <FileText className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {prescriptionsOnly && result.records.length > 0
                      ? 'No prescription records found. Toggle off "Prescriptions only" to see all records.'
                      : 'No medical records found'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          Type
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          OCR Status
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          Date
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-border/30 last:border-0"
                        >
                          <td className="px-4 py-3 font-medium">{record.recordType}</td>
                          <td className="px-4 py-3">{getOcrBadge(record.ocrStatus)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(record.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/pharmacist/records/${record.id}`}>
                              <Button variant="outline" size="sm">
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
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 py-12 text-center">
              <AlertCircle className="size-8 text-amber-500" />
              <h3 className="mt-3 text-sm font-semibold">Medical Records Restricted</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                This patient has not granted hospital consent. Only personal information is visible. Medical records will become accessible once the patient grants and a hospital admin approves consent.
              </p>
            </div>
          )}
        </div>
        )
      })()}
    </div>
  )
}

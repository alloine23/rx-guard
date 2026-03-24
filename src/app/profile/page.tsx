'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Building2,
  Shield,
  BadgeCheck,
  Pencil,
  Check,
  X,
  Loader2,
  Hash,
} from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

interface Profile {
  id: string
  email: string
  role: string
  createdAt: string
  institution: {
    id: string
    name: string
    type: string
    location: string | null
  } | null
  patient?: {
    patientCode: string
    fullName: string
    dateOfBirth: string
    phone: string | null
    email: string | null
  }
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Institution Admin',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  patient: 'Patient',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function InfoRow({
  icon: Icon,
  label,
  value,
  editable,
  editing,
  editValue,
  onEditChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  saving,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  editable?: boolean
  editing?: boolean
  editValue?: string
  onEditChange?: (v: string) => void
  onEditStart?: () => void
  onEditSave?: () => void
  onEditCancel?: () => void
  saving?: boolean
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={editValue ?? ''}
              onChange={(e) => onEditChange?.(e.target.value)}
              className="h-8 max-w-xs text-sm"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary hover:text-primary"
              onClick={onEditSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={onEditCancel}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-sm font-medium">
              {value || <span className="text-muted-foreground/60">Not provided</span>}
            </p>
            {editable && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-primary"
                onClick={onEditStart}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Phone editing
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValue, setPhoneValue] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('Failed to load profile')
      const data: Profile = await res.json()
      setProfile(data)
    } catch {
      setError('Unable to load profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  async function handleSavePhone() {
    setSavingPhone(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneValue || null }),
      })
      if (!res.ok) throw new Error('Failed to update')
      sileo.success({ title: 'Phone number updated' })
      setEditingPhone(false)
      fetchProfile()
    } catch {
      sileo.error({ title: 'Failed to update phone number' })
    } finally {
      setSavingPhone(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error || 'Profile not found'}
        </div>
      </div>
    )
  }

  const isPatient = profile.role === 'patient' && profile.patient

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground">
          View and manage your account information
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border/50">
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <div className="flex items-start gap-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Role
                </p>
                <div className="mt-1">
                  <Badge variant="secondary" className="capitalize">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </Badge>
                </div>
              </div>
            </div>
            <InfoRow
              icon={Calendar}
              label="Member Since"
              value={formatDate(profile.createdAt)}
            />
            {profile.institution && (
              <InfoRow
                icon={Building2}
                label="Institution"
                value={`${profile.institution.name}${profile.institution.location ? ` — ${profile.institution.location}` : ''}`}
              />
            )}
          </CardContent>
        </Card>

        {/* Patient Profile (only for patients) */}
        {isPatient && profile.patient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/50">
              <InfoRow
                icon={Hash}
                label="Patient Code"
                value={profile.patient.patientCode}
              />
              <InfoRow
                icon={User}
                label="Full Name"
                value={profile.patient.fullName}
              />
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={profile.patient.dateOfBirth ? formatDate(profile.patient.dateOfBirth) : null}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={profile.patient.phone}
                editable
                editing={editingPhone}
                editValue={phoneValue}
                onEditChange={setPhoneValue}
                onEditStart={() => {
                  setPhoneValue(profile.patient?.phone ?? '')
                  setEditingPhone(true)
                }}
                onEditSave={handleSavePhone}
                onEditCancel={() => setEditingPhone(false)}
                saving={savingPhone}
              />
              <InfoRow
                icon={Mail}
                label="Contact Email"
                value={profile.patient.email}
              />
            </CardContent>
          </Card>
        )}

        {/* Non-patient roles get a single card */}
        {!isPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                To change your password, use the Change Password option from the menu.
              </p>
              <Separator className="my-4" />
              <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Contact your institution administrator to update your account details.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

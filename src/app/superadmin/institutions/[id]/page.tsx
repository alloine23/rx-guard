'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBreadcrumbOverride } from '@/components/breadcrumb-context'
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  Users,
  FileText,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { sileo } from 'sileo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Admin {
  id: string
  email: string
  isActive: boolean
  createdAt: string
}

interface Institution {
  id: string
  name: string
  type: 'hospital' | 'pharmacy'
  location: string | null
  credentialsUrl: string | null
  createdAt: string
  users: Admin[]
  _count: {
    users: number
    records: number
    patientConsents: number
  }
}

export default function InstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { setOverride } = useBreadcrumbOverride()

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [adminSubmitting, setAdminSubmitting] = useState(false)
  const [adminError, setAdminError] = useState('')

  const [deleting, setDeleting] = useState(false)

  const fetchInstitution = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`/api/admin/institutions/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Institution not found')
        throw new Error('Failed to fetch institution')
      }
      const data = await res.json()
      setInstitution(data)
      setOverride(id, data.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [id, setOverride])

  useEffect(() => {
    fetchInstitution()
  }, [fetchInstitution])

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEditSubmitting(true)
    setEditError('')

    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get('name') as string,
      type: form.get('type') as string,
      location: (form.get('location') as string) || null,
      credentialsUrl: (form.get('credentialsUrl') as string) || null,
    }

    try {
      const res = await fetch(`/api/admin/institutions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update institution')
      }

      setEditDialogOpen(false)
      await fetchInstitution()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleAssignAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAdminSubmitting(true)
    setAdminError('')

    const form = new FormData(e.currentTarget)
    const body = {
      email: form.get('email') as string,
      password: form.get('password') as string,
    }

    try {
      const res = await fetch(`/api/admin/institutions/${id}/assign-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to assign admin')
      }

      setAdminDialogOpen(false)
      await fetchInstitution()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAdminSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/institutions/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete institution')
      }

      sileo.success({ title: 'Institution deleted' })
      router.push('/superadmin/institutions')
    } catch (err) {
      sileo.error({ title: err instanceof Error ? err.message : 'Failed to delete institution' })
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-5">
              <div className="space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/superadmin/institutions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Institutions
        </Link>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!institution) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/superadmin/institutions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Institutions
        </Link>
        <div className="flex items-center gap-2">
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Institution</DialogTitle>
                <DialogDescription>
                  Update institution details.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-name"
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Name
                  </Label>
                  <Input
                    id="edit-name"
                    name="name"
                    required
                    defaultValue={institution.name}
                    className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-type"
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Type
                  </Label>
                  <Select name="type" required defaultValue={institution.type}>
                    <SelectTrigger className="h-10 w-full rounded-lg bg-muted/40 px-3 text-sm focus-visible:bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hospital">Hospital</SelectItem>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-location"
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Location
                    <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Input
                    id="edit-location"
                    name="location"
                    defaultValue={institution.location ?? ''}
                    placeholder="City, Province"
                    className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-credentials"
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Credentials URL
                    <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Input
                    id="edit-credentials"
                    name="credentialsUrl"
                    type="url"
                    defaultValue={institution.credentialsUrl ?? ''}
                    placeholder="https://..."
                    className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                  />
                </div>
                {editError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                    {editError}
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={editSubmitting}>
                    {editSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Institution</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{institution.name}</strong>? This
                  action cannot be undone. All associated users and data will be permanently
                  removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Users"
          value={institution._count.users}
          icon={Users}
          description="Total assigned users"
        />
        <StatCard
          title="Records"
          value={institution._count.records}
          icon={FileText}
          description="Medical records stored"
        />
        <StatCard
          title="Consents"
          value={institution._count.patientConsents}
          icon={ShieldCheck}
          description="Patient consent entries"
        />
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{institution.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge
                  variant={institution.type === 'hospital' ? 'default' : 'secondary'}
                  className={
                    institution.type === 'hospital'
                      ? 'bg-primary/10 text-primary hover:bg-primary/15 border-0'
                      : 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 border-0'
                  }
                >
                  {institution.type === 'hospital' ? 'Hospital' : 'Pharmacy'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Created{' '}
                  {new Date(institution.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {institution.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {institution.location}
            </div>
          )}
          {institution.credentialsUrl && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={institution.credentialsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Credentials Document
              </a>
            </div>
          )}
          {!institution.location && !institution.credentialsUrl && (
            <p className="text-sm text-muted-foreground">
              No additional details provided.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Institution Admins</h3>
            <p className="text-xs text-muted-foreground">
              Users with administrative access to this institution
            </p>
          </div>
          <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Assign Admin
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Admin</DialogTitle>
                <DialogDescription>
                  Create a new admin account for {institution.name}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAssignAdmin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="admin-email"
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="admin-email"
                    name="email"
                    type="email"
                    required
                    placeholder="admin@institution.ph"
                    className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="admin-password"
                    className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Temporary Password
                  </Label>
                  <Input
                    id="admin-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    className="h-10 rounded-lg bg-muted/40 px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground/60">
                    Admin will be required to change this on first login.
                  </p>
                </div>
                {adminError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                    {adminError}
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={adminSubmitting}>
                    {adminSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Assigning...
                      </span>
                    ) : (
                      'Assign Admin'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {institution.users.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card py-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="mt-3 text-sm font-medium">No admins assigned</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Assign an admin to manage this institution.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Email
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institution.users.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.isActive ? 'default' : 'secondary'}
                        className={
                          admin.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 border-0'
                            : 'bg-muted text-muted-foreground border-0'
                        }
                      >
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(admin.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

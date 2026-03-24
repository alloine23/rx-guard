'use client'

import { useEffect, useState } from 'react'
import { sileo } from 'sileo'
import {
  Users,
  ShieldCheck,
  ShieldX,
  Building2,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DataTable,
  DataTableColumnHeader,
} from '@/components/data-table'

interface UserRow {
  id: string
  email: string
  role: string
  isActive: boolean
  forcePasswordChange: boolean
  createdAt: string
  institution: { id: string; name: string; type: string } | null
}

const ROLE_OPTIONS = [
  { label: 'Superadmin', value: 'superadmin' },
  { label: 'Admin', value: 'admin' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Pharmacist', value: 'pharmacist' },
  { label: 'Patient', value: 'patient' },
]

function getRoleBadge(role: string) {
  const styles: Record<string, string> = {
    superadmin: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    admin: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    doctor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    pharmacist: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    patient: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  }
  return (
    <Badge className={`${styles[role] ?? 'bg-muted text-muted-foreground'} border-0 text-[11px] capitalize`}>
      {role}
    </Badge>
  )
}

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null)

  useEffect(() => {
    fetch('/api/superadmin/users')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load users')
        setUsers(await res.json())
      })
      .catch(() => setFetchError('Unable to load users.'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async () => {
    if (!confirmUser) return
    const target = confirmUser
    const newIsActive = !target.isActive
    setConfirmUser(null)
    setActionLoading(target.id)

    // Optimistic update — no stutter
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, isActive: newIsActive } : u))
    )

    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.id, isActive: newIsActive }),
      })
      if (!res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === target.id ? { ...u, isActive: target.isActive } : u))
        )
        const body = await res.json().catch(() => ({}))
        sileo.error({ title: body.error ?? 'Failed to update user' })
        return
      }
      sileo.success({ title: `${target.email} ${newIsActive ? 'activated' : 'deactivated'}` })
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, isActive: target.isActive } : u))
      )
      sileo.error({ title: 'Network error. Please try again.' })
    } finally {
      setActionLoading(null)
    }
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.getValue('email')}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => getRoleBadge(row.getValue('role')),
      filterFn: (row, id, value) => (value as string[]).includes(row.getValue(id)),
    },
    {
      id: 'institution',
      accessorFn: (row) => row.institution?.name ?? '\u2014',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Institution" />
      ),
      cell: ({ row }) => {
        const inst = row.original.institution
        return inst ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-3.5" />
            {inst.name}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{'\u2014'}</span>
        )
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const active = row.getValue('isActive') as boolean
        return active ? (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[11px]">
            <ShieldCheck className="mr-1 size-3" />
            Active
          </Badge>
        ) : (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[11px]">
            <ShieldX className="mr-1 size-3" />
            Inactive
          </Badge>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.getValue('createdAt') as string).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Action" />
      ),
      cell: ({ row }) => {
        const user = row.original
        const isLoading = actionLoading === user.id
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={
                      user.isActive
                        ? 'text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400'
                        : 'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400'
                    }
                    disabled={isLoading}
                    onClick={() => setConfirmUser(user)}
                  />
                }
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : user.isActive ? (
                  <UserX className="size-4" />
                ) : (
                  <UserCheck className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {user.isActive ? 'Deactivate user' : 'Activate user'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-64 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{fetchError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">User Management</h2>
        <p className="text-sm text-muted-foreground">
          View and manage all system users
        </p>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchKey="email"
        searchPlaceholder="Search by email..."
        filters={[
          {
            columnId: 'role',
            title: 'Role',
            options: ROLE_OPTIONS,
          },
        ]}
      />

      <AlertDialog open={!!confirmUser} onOpenChange={(open) => { if (!open) setConfirmUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmUser?.isActive ? 'Deactivate' : 'Activate'} user?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser?.isActive
                ? `This will prevent ${confirmUser.email} from logging in or accessing the system.`
                : `This will restore access for ${confirmUser?.email}, allowing them to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmUser?.isActive ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={handleToggle}
            >
              {confirmUser?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

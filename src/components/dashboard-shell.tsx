'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { BreadcrumbProvider, useBreadcrumbOverride } from '@/components/breadcrumb-context'
import type { UserRole, InstitutionType } from '@prisma/client'
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Building2,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  Hand,
  LayoutDashboard,
  LogOut,
  Pill,
  Search,
  Stethoscope,
  Users,
  XCircle,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/logo'

/* ─────────────────── Config ─────────────────── */

type NavItem = {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  superadmin: [
    { title: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard },
    { title: 'Institutions', href: '/superadmin/institutions', icon: Building2 },
    { title: 'Users', href: '/superadmin/users', icon: Users },
    { title: 'Audit Logs', href: '/superadmin/audit-logs', icon: FileText },
  ],
  'admin:hospital': [
    { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Doctors', href: '/admin/doctors', icon: Stethoscope },
    { title: 'Consents', href: '/admin/consents', icon: ClipboardList },
    { title: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
  ],
  'admin:pharmacy': [
    { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Pharmacists', href: '/admin/pharmacists', icon: Pill },
    { title: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
  ],
  doctor: [
    { title: 'Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard },
    { title: 'Patients', href: '/doctor/patients', icon: Users },
    { title: 'Consents', href: '/doctor/consents', icon: ClipboardList },
  ],
  pharmacist: [
    { title: 'Dashboard', href: '/pharmacist/dashboard', icon: LayoutDashboard },
    { title: 'Search', href: '/pharmacist/search', icon: Search },
    { title: 'Verifications', href: '/pharmacist/verifications', icon: ClipboardCheck },
  ],
  patient: [
    { title: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
    { title: 'Records', href: '/patient/records', icon: FileText },
    { title: 'Consents', href: '/patient/consents', icon: ClipboardList },
    { title: 'ID Card', href: '/patient/id-card', icon: CreditCard },
    { title: 'Access Logs', href: '/patient/access-logs', icon: Eye },
  ],
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'System Admin',
  admin: 'Institution Admin',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  patient: 'Patient',
}

import { capitalize, buildBreadcrumbItems } from '@/lib/breadcrumb-utils'

function getInitials(email: string): string {
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/* ─────────────────── Notifications ─────────────────── */

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CONSENT_APPROVED: CheckCircle2,
  CONSENT_REJECTED: XCircle,
  CONSENT_REQUESTED: ClipboardList,
  WELCOME: Hand,
  PRESCRIPTION_DISPENSED: Pill,
  PRESCRIPTION_REJECTED: AlertTriangle,
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/* ─────────────────── NavUser ─────────────────── */

function NavUser({ email, role }: { email: string; role: string }) {
  const { isMobile } = useSidebar()
  const [showSignOut, setShowSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Notification state
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch {
      // silently ignore fetch errors
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-all-read' }),
    })
    fetchNotifications()
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <>
      <SidebarMenu>
        {/* Notification bell */}
        <SidebarMenuItem>
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  tooltip="Notifications"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                />
              }
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <div className="relative">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Notifications</span>
                {unreadCount > 0 ? (
                  <span className="truncate text-xs">{unreadCount} unread</span>
                ) : (
                  <span className="truncate text-xs">All caught up</span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-0"
              side={isMobile ? 'top' : 'right'}
              align="end"
              sideOffset={8}
            >
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="mb-2 size-5 opacity-40" />
                    <span className="text-sm">No notifications</span>
                  </div>
                ) : (
                  notifications.map((notif: any) => {
                    const Icon = NOTIFICATION_ICONS[notif.type] ?? Bell
                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                          !notif.read
                            ? 'bg-accent/50'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            {notif.message ?? notif.description ?? notif.type}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>

        {/* User dropdown */}
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                />
              }
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {getInitials(email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{email.split('@')[0]}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--anchor-width] min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {getInitials(email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{email.split('@')[0]}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <BadgeCheck />
                  {ROLE_LABELS[role] ?? role}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                  <Users />
                  Profile
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSignOut(true)}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={showSignOut} onOpenChange={(open) => { if (!signingOut) setShowSignOut(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to the login page and will need to enter
              your credentials again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing out...
                </span>
              ) : (
                'Sign Out'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ─────────────────── Sidebar ─────────────────── */

function AppSidebar({ role, email, institutionType }: { role: string; email: string; institutionType?: string | null }) {
  const pathname = usePathname()
  const navKey = role === 'admin' && institutionType ? `admin:${institutionType}` : role
  const navItems = NAV_BY_ROLE[navKey] ?? NAV_BY_ROLE[role] ?? []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-active:bg-transparent hover:bg-transparent active:bg-transparent"
            >
              <Logo size={36} className="!size-9" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">RxGuard</span>
                <span className="truncate text-xs">EHR Platform</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${role}/dashboard` &&
                    pathname.startsWith(item.href))

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser email={email} role={role} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

/* ─────────────────── Breadcrumbs ─────────────────── */

function DashboardBreadcrumbs() {
  const pathname = usePathname()
  const { overrides, customBreadcrumbs } = useBreadcrumbOverride()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const roleSegment = segments[0]
  const roleLabel = capitalize(roleSegment)

  // Custom breadcrumbs: empty array = loading, populated = render custom trail
  if (customBreadcrumbs !== null && customBreadcrumbs.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink
              render={<Link href={`/${roleSegment}/dashboard`} />}
            >
              {roleLabel}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <Skeleton className="h-4 w-32" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  if (customBreadcrumbs && customBreadcrumbs.length > 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink
              render={<Link href={`/${roleSegment}/dashboard`} />}
            >
              {roleLabel}
            </BreadcrumbLink>
          </BreadcrumbItem>

          {customBreadcrumbs.map((item, i) => {
            const isCurrent = i === customBreadcrumbs.length - 1
            return (
              <React.Fragment key={item.href}>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  {isCurrent ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={item.href} />}>
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  const { items: breadcrumbItems } = buildBreadcrumbItems(pathname, overrides)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          {breadcrumbItems.length > 0 ? (
            <BreadcrumbLink
              render={<Link href={`/${roleSegment}/dashboard`} />}
            >
              {roleLabel}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{roleLabel}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {breadcrumbItems.map((item) => (
          <React.Fragment key={item.href}>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              {item.isCurrent ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={item.href} />}>
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/* ─────────────────── Shell ─────────────────── */

interface DashboardShellProps {
  role: UserRole
  email: string
  institutionType?: InstitutionType | null
  children: React.ReactNode
}

export function DashboardShell({ role, email, institutionType, children }: DashboardShellProps) {
  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <AppSidebar role={role} email={email} institutionType={institutionType} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <DashboardBreadcrumbs />
            </div>
            <ThemeToggle />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  )
}

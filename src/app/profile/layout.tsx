import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <DashboardShell
      role={session.user.role}
      email={session.user.email ?? ''}
      institutionType={session.user.institutionType}
    >
      {children}
    </DashboardShell>
  )
}

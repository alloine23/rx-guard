import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'

export default async function PharmacistLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'pharmacist') redirect('/login')

  return (
    <DashboardShell
      role={session.user.role}
      email={session.user.email ?? ''}
    >
      {children}
    </DashboardShell>
  )
}

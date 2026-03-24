import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!session.user.institutionId) {
    return NextResponse.json(
      { error: 'Admin must belong to an institution' },
      { status: 400 }
    )
  }

  const { id } = await params

  const pharmacist = await prisma.user.findUnique({ where: { id } })
  if (!pharmacist) {
    return NextResponse.json({ error: 'Pharmacist not found' }, { status: 404 })
  }

  if (pharmacist.role !== 'pharmacist' || pharmacist.institutionId !== session.user.institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Clean up system records, then delete user
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.auditLog.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  await createAuditLog({
    userId: session.user.id,
    action: 'DELETE_PHARMACIST',
    resourceType: 'User',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    metadata: { email: pharmacist.email },
  })

  return NextResponse.json({ message: 'Pharmacist deleted' })
}

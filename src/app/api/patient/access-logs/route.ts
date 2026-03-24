import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const recordIds = (
    await prisma.medicalRecord.findMany({
      where: { patientId: patient.id },
      select: { id: true },
    })
  ).map((r) => r.id)

  if (recordIds.length === 0) {
    return NextResponse.json([])
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['VIEW_RECORD', 'VERIFY_PRESCRIPTION', 'DISPENSE_PRESCRIPTION', 'REJECT_PRESCRIPTION'],
      },
      resourceId: { in: recordIds },
      userId: { not: session.user.id },
    },
    include: {
      user: { select: { email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(logs)
}

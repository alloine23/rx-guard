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
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Consent breakdown by status
  const consentBreakdown = await prisma.consent.groupBy({
    by: ['status'],
    where: { patientId: patient.id },
    _count: true,
  })

  // Total records
  const totalRecords = await prisma.medicalRecord.count({
    where: { patientId: patient.id },
  })

  // Get all resource IDs related to this patient (their records + their patient ID)
  const patientRecords = await prisma.medicalRecord.findMany({
    where: { patientId: patient.id },
    select: { id: true },
  })
  const resourceIds = patientRecords.map(r => r.id).concat([patient.id])

  // Recent activity from audit logs (last 10 events related to this patient)
  const recentActivity = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          'UPLOAD_RECORD',
          'VIEW_RECORD',
          'VERIFY_PRESCRIPTION',
          'DISPENSE_PRESCRIPTION',
          'REJECT_PRESCRIPTION',
          'GRANT_CONSENT',
          'REVOKE_CONSENT',
          'APPROVE_CONSENT',
          'REJECT_CONSENT',
        ],
      },
      resourceId: { in: resourceIds },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      action: true,
      createdAt: true,
      metadata: true,
    },
  })

  return NextResponse.json({
    consentBreakdown: consentBreakdown.map(c => ({
      status: c.status,
      count: c._count,
    })),
    totalRecords,
    recentActivity,
  })
}

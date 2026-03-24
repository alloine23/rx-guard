import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'pharmacist') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { institutionId } = session.user
  if (!institutionId) {
    return NextResponse.json(
      { error: 'Pharmacist must belong to an institution' },
      { status: 400 }
    )
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { type: true },
  })
  if (!institution || institution.type !== 'pharmacy') {
    return NextResponse.json(
      { error: 'Your institution is not a pharmacy' },
      { status: 403 }
    )
  }

  const pharmacyFilter = { pharmacist: { institutionId } }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [totalVerifications, pendingDispense, todayActivity, recentVerifications] =
    await Promise.all([
      prisma.prescriptionVerification.count({
        where: pharmacyFilter,
      }),
      prisma.prescriptionVerification.count({
        where: { ...pharmacyFilter, status: 'verified' },
      }),
      prisma.prescriptionVerification.count({
        where: {
          ...pharmacyFilter,
          verifiedAt: { gte: startOfToday },
        },
      }),
      prisma.prescriptionVerification.findMany({
        where: pharmacyFilter,
        include: {
          record: {
            select: {
              recordType: true,
              patient: {
                select: { patientCode: true, fullName: true },
              },
            },
          },
        },
        orderBy: { verifiedAt: 'desc' },
        take: 5,
      }),
    ])

  return NextResponse.json({
    totalVerifications,
    pendingDispense,
    todayActivity,
    recentVerifications: recentVerifications.map((v) => ({
      id: v.id,
      recordType: v.record.recordType,
      patientCode: v.record.patient.patientCode,
      patientName: decrypt(v.record.patient.fullName),
      status: v.status,
      verifiedAt: v.verifiedAt,
    })),
  })
}

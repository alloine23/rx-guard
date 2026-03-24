import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { role, institutionId } = session.user

  if (role === 'superadmin') {
    const [hospitals, pharmacies, doctors, patients] = await Promise.all([
      prisma.institution.count({ where: { type: 'hospital' } }),
      prisma.institution.count({ where: { type: 'pharmacy' } }),
      prisma.user.count({ where: { role: 'doctor' } }),
      prisma.patient.count(),
    ])

    return NextResponse.json({ hospitals, pharmacies, doctors, patients })
  }

  if (role === 'admin' && institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { type: true },
    })

    if (institution?.type === 'pharmacy') {
      const [pharmacists, verifications, dispensed, verified, rejected] = await Promise.all([
        prisma.user.count({
          where: { role: 'pharmacist', institutionId },
        }),
        prisma.prescriptionVerification.count({
          where: { pharmacist: { institutionId } },
        }),
        prisma.prescriptionVerification.count({
          where: { pharmacist: { institutionId }, status: 'dispensed' },
        }),
        prisma.prescriptionVerification.count({
          where: { pharmacist: { institutionId }, status: 'verified' },
        }),
        prisma.prescriptionVerification.count({
          where: { pharmacist: { institutionId }, status: 'rejected' },
        }),
      ])

      return NextResponse.json({ institutionType: 'pharmacy', pharmacists, verifications, dispensed, verified, rejected })
    }

    // Hospital
    const [doctors, patients, records, pendingConsents] = await Promise.all([
      prisma.user.count({
        where: { role: 'doctor', institutionId },
      }),
      prisma.patient.count({
        where: {
          doctor: { institutionId },
        },
      }),
      prisma.medicalRecord.count({
        where: { institutionId },
      }),
      prisma.consent.count({
        where: { hospitalId: institutionId, status: 'pending' },
      }),
    ])

    return NextResponse.json({ institutionType: 'hospital', doctors, patients, records, pendingConsents })
  }

  if (role === 'doctor') {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const [patients, records, pendingOcr, monthlyRaw, recordsByTypeRaw] = await Promise.all([
      prisma.patient.count({
        where: { registeredBy: session.user.id },
      }),
      prisma.medicalRecord.count({
        where: { uploadedBy: session.user.id },
      }),
      prisma.medicalRecord.count({
        where: {
          uploadedBy: session.user.id,
          ocrStatus: { in: ['pending', 'processing'] },
        },
      }),
      prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*)::bigint as count
        FROM patients
        WHERE registered_by = ${session.user.id}::uuid
          AND created_at >= ${sixMonthsAgo}
        GROUP BY month
        ORDER BY month
      `,
      prisma.$queryRaw<{ type: string; count: bigint }[]>`
        SELECT COALESCE(record_type, 'general') as type, COUNT(*)::bigint as count
        FROM medical_records
        WHERE uploaded_by = ${session.user.id}::uuid
        GROUP BY record_type
      `,
    ])

    const monthlyRegistrations = monthlyRaw.map(r => ({
      month: r.month,
      count: Number(r.count),
    }))

    const recordsByType = recordsByTypeRaw.map(r => ({
      type: r.type,
      count: Number(r.count),
    }))

    return NextResponse.json({ patients, records, pendingOcr, monthlyRegistrations, recordsByType })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

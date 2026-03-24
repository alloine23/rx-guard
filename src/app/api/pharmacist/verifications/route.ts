import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { createAuditLog } from '@/lib/audit'
import { requireConsentByRecordId, ConsentError } from '@/lib/consent-gate'
import { createVerificationSchema } from '@/lib/validations/verification'

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const where = {
    pharmacist: { institutionId },
    ...(statusFilter && statusFilter !== 'all'
      ? { status: statusFilter as 'verified' | 'dispensed' | 'rejected' }
      : {}),
    ...(search
      ? { record: { patient: { patientCode: { contains: search, mode: 'insensitive' as const } } } }
      : {}),
  }

  const [verifications, total] = await Promise.all([
    prisma.prescriptionVerification.findMany({
      where,
      include: {
        record: {
          select: {
            id: true,
            recordType: true,
            patient: {
              select: {
                patientCode: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { verifiedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prescriptionVerification.count({ where }),
  ])

  const data = verifications.map((v) => ({
    id: v.id,
    recordId: v.record.id,
    recordType: v.record.recordType,
    patientCode: v.record.patient.patientCode,
    patientName: decrypt(v.record.patient.fullName),
    status: v.status,
    verifiedAt: v.verifiedAt,
    dispensedAt: v.dispensedAt,
    rejectionReason: v.rejectionReason,
  }))

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const parsed = createVerificationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { recordId } = parsed.data

  try {
    await requireConsentByRecordId(recordId)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  const existing = await prisma.prescriptionVerification.findFirst({
    where: {
      recordId,
      status: { in: ['verified', 'dispensed'] },
      pharmacist: { institutionId },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'This prescription has already been verified' },
      { status: 409 }
    )
  }

  const verification = await prisma.prescriptionVerification.create({
    data: {
      recordId,
      pharmacistId: session.user.id,
      status: 'verified',
    },
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'VERIFY_PRESCRIPTION',
    resourceType: 'PrescriptionVerification',
    resourceId: verification.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json(verification, { status: 201 })
}

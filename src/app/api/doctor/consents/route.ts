import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { institutionId } = session.user
  if (!institutionId) {
    return NextResponse.json({ error: 'Doctor must belong to an institution' }, { status: 400 })
  }

  const consents = await prisma.consent.findMany({
    where: { hospitalId: institutionId },
    include: {
      patient: {
        select: { patientCode: true, fullName: true, registeredBy: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  // Only show consents for patients this doctor registered
  const doctorConsents = consents
    .filter((c) => c.patient.registeredBy === session.user.id)
    .map((c) => ({
      ...c,
      patient: {
        ...c.patient,
        fullName: decrypt(c.patient.fullName),
      },
    }))

  return NextResponse.json(doctorConsents)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { institutionId } = session.user
  if (!institutionId) {
    return NextResponse.json({ error: 'Doctor must belong to an institution' }, { status: 400 })
  }

  const body = await req.json()
  const { patientId } = body as { patientId: string }

  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
  }

  // Verify patient exists and was registered by this doctor
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  })
  if (!patient || patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Patient not found or not registered by you' }, { status: 404 })
  }

  // Check for existing active consent at this hospital
  const existing = await prisma.consent.findFirst({
    where: {
      patientId,
      hospitalId: institutionId,
      status: { in: ['pending', 'approved'] },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'An active or pending consent already exists for this patient at your hospital' },
      { status: 409 }
    )
  }

  const consent = await prisma.consent.create({
    data: {
      patientId,
      hospitalId: institutionId,
      status: 'pending',
    },
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'GRANT_CONSENT',
    resourceType: 'Consent',
    resourceId: consent.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json(consent, { status: 201 })
}

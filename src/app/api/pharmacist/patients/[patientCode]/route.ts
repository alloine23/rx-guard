import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { createAuditLog } from '@/lib/audit'
import { checkConsent } from '@/lib/consent-gate'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patientCode: string }> }
) {
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

  const { patientCode } = await params

  const patient = await prisma.patient.findUnique({
    where: { patientCode },
  })
  if (!patient) {
    return NextResponse.json(
      { error: 'No patient found with this code' },
      { status: 404 }
    )
  }

  const hasConsent = await checkConsent(patient.id)

  const decryptedPatient = {
    id: patient.id,
    patientCode: patient.patientCode,
    fullName: decrypt(patient.fullName),
    phone: patient.phone ? decrypt(patient.phone) : null,
    email: patient.email ? decrypt(patient.email) : null,
    dateOfBirth: decrypt(patient.dateOfBirth),
    photoUrl: patient.photoUrl ?? null,
  }

  let records: { id: string; recordType: string | null; ocrStatus: string; createdAt: Date }[] = []

  if (hasConsent) {
    records = await prisma.medicalRecord.findMany({
      where: { patientId: patient.id },
      select: {
        id: true,
        recordType: true,
        ocrStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  await createAuditLog({
    userId: session.user.id,
    action: 'VIEW_PATIENT',
    resourceType: 'Patient',
    resourceId: patient.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({
    patient: decryptedPatient,
    records,
    hasConsent,
  })
}

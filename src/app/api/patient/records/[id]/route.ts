import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 })
  }

  const { id } = await params

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      institution: { select: { name: true } },
    },
  })

  if (!record || record.patientId !== patient.id) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const imageUrl = record.imageUrl ? `/api/records/image/${record.id}` : null

  await createAuditLog({
    userId: session.user.id,
    action: 'VIEW_OWN_RECORD',
    resourceType: 'MedicalRecord',
    resourceId: record.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({
    id: record.id,
    recordType: record.recordType,
    ocrStatus: record.ocrStatus,
    ocrData: record.ocrData,
    ocrConfidence: record.ocrConfidence,
    imageUrl,
    createdAt: record.createdAt,
    institution: record.institution,
  })
}

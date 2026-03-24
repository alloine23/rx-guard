import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
// Image served via /api/records/image/[id] proxy
import { decrypt } from '@/lib/crypto'
import { correctRecordSchema, correctDynamicRecordSchema } from '@/lib/validations/medical-record'
import { ocrQueue } from '@/lib/queue'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: { select: { registeredBy: true, patientCode: true, fullName: true } },
    },
  })

  if (!record || record.patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const imageUrl = record.imageUrl ? `/api/records/image/${record.id}` : null

  return NextResponse.json({
    id: record.id,
    patientCode: record.patient.patientCode,
    patientName: decrypt(record.patient.fullName),
    recordType: record.recordType,
    ocrStatus: record.ocrStatus,
    ocrEngine: record.ocrEngine,
    ocrData: record.ocrData,
    ocrConfidence: record.ocrConfidence,
    isDuplicate: record.isDuplicate,
    imageUrl,
    createdAt: record.createdAt,
    signatureStatus: record.signatureStatus,
    signedAt: record.signedAt,
    signedDataHash: record.signedDataHash,
    verifyToken: record.verifyToken,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: { select: { registeredBy: true } },
    },
  })

  if (!record || record.patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (record.signatureStatus === 'signed') {
    return NextResponse.json(
      { error: 'Cannot edit a signed record' },
      { status: 409 },
    )
  }

  const body = await req.json()

  // Engine-aware validation
  const schema = record.ocrEngine === 'llm_direct'
    ? correctDynamicRecordSchema
    : correctRecordSchema
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Sync recordType from dynamic ocrData
  const updateData: { ocrData: Prisma.InputJsonValue; recordType?: string } = {
    ocrData: parsed.data.ocrData as Prisma.InputJsonValue,
  }
  if (
    record.ocrEngine === 'llm_direct' &&
    typeof (parsed.data.ocrData as Record<string, unknown>).record_type === 'string'
  ) {
    updateData.recordType = (parsed.data.ocrData as Record<string, unknown>).record_type as string
  }

  await prisma.medicalRecord.update({
    where: { id },
    data: updateData,
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'CORRECT_RECORD',
    resourceType: 'MedicalRecord',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({ success: true })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      patient: { select: { registeredBy: true } },
    },
  })

  if (!record || record.patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (record.signatureStatus === 'signed') {
    return NextResponse.json(
      { error: 'Cannot re-process a signed record' },
      { status: 409 },
    )
  }

  if (!record.imageUrl) {
    return NextResponse.json({ error: 'No image to process' }, { status: 400 })
  }

  // Preserve LLM direct mode for re-processing
  const wasLlmDirect = record.ocrEngine === 'llm_direct'

  // Reset OCR status and re-queue
  await prisma.medicalRecord.update({
    where: { id },
    data: {
      ocrStatus: 'pending',
      ocrData: undefined,
      ocrConfidence: null,
      ocrEngine: null,
    },
  })

  await ocrQueue.add('ocr', {
    recordId: id,
    minioKey: record.imageUrl,
    ...(wasLlmDirect && { mode: 'llm_direct' as const }),
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'REPROCESS_RECORD',
    resourceType: 'MedicalRecord',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({ success: true })
}

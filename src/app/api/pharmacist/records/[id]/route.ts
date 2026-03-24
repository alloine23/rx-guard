import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { requireConsentByRecordId, ConsentError } from '@/lib/consent-gate'
import {
  canonicalizePrescriptionData,
  verifyPrescription,
} from '@/lib/prescription-signing'

const ALLOWED_OCR_FIELDS = ['medications', 'doctor_name', 'date', 'record_type']

function filterOcrData(ocrData: unknown): Record<string, unknown> {
  if (!ocrData || typeof ocrData !== 'object') return {}
  const data = ocrData as Record<string, unknown>
  const filtered: Record<string, unknown> = {}
  for (const key of ALLOWED_OCR_FIELDS) {
    if (key in data) {
      filtered[key] = data[key]
    }
  }
  return filtered
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params

  try {
    await requireConsentByRecordId(id)
  } catch (err) {
    if (err instanceof ConsentError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      verifications: {
        where: {
          pharmacist: { institutionId },
        },
        orderBy: { verifiedAt: 'desc' },
      },
      signedBy: {
        include: {
          doctorKeyPair: { select: { publicKey: true } },
        },
      },
    },
  })

  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  let signatureValid: boolean | null = null
  let signedByName: string | null = null

  if (record.signatureStatus === 'signed' && record.digitalSignature && record.signedBy?.doctorKeyPair) {
    const canonicalData = canonicalizePrescriptionData(
      (record.ocrData as Record<string, unknown>) ?? {},
    )
    signatureValid = verifyPrescription(
      canonicalData,
      record.digitalSignature,
      record.signedBy.doctorKeyPair.publicKey,
    )
    signedByName = record.signedBy.email.split('@')[0]
  }

  const imageUrl = record.imageUrl ? `/api/records/image/${record.id}` : null

  await createAuditLog({
    userId: session.user.id,
    action: 'VIEW_RECORD',
    resourceType: 'MedicalRecord',
    resourceId: record.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({
    id: record.id,
    recordType: record.recordType,
    ocrStatus: record.ocrStatus,
    ocrData: filterOcrData(record.ocrData),
    imageUrl,
    createdAt: record.createdAt,
    verifications: record.verifications,
    signatureStatus: record.signatureStatus,
    signedAt: record.signedAt,
    signedByName,
    signatureValid,
  })
}

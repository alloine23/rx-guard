import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import {
  canonicalizePrescriptionData,
  canonicalizeRecordData,
  verifyPrescription,
  hashPrescriptionData,
} from '@/lib/prescription-signing'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const { allowed } = await rateLimit(`verify:${ip}`, 20, 900)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { recordId } = await params
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing verification token' }, { status: 400 })
  }

  const record = await prisma.medicalRecord.findUnique({
    where: { id: recordId },
    include: {
      signedBy: {
        include: {
          doctorKeyPair: { select: { publicKey: true } },
        },
      },
    },
  })

  if (!record || record.verifyToken !== token) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (record.signatureStatus !== 'signed' || !record.digitalSignature || !record.signedBy?.doctorKeyPair) {
    return NextResponse.json({ signed: false })
  }

  const canonicalData = record.ocrEngine === 'llm_direct'
    ? canonicalizeRecordData((record.ocrData as Record<string, unknown>) ?? {})
    : canonicalizePrescriptionData((record.ocrData as Record<string, unknown>) ?? {})
  const currentHash = hashPrescriptionData(canonicalData)
  const tampered = currentHash !== record.signedDataHash

  const valid = verifyPrescription(
    canonicalData,
    record.digitalSignature,
    record.signedBy.doctorKeyPair.publicKey,
  )

  return NextResponse.json({
    signed: true,
    valid,
    tampered,
    signedAt: record.signedAt,
    algorithm: 'Ed25519',
  })
}

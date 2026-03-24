import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { createAuditLog } from '@/lib/audit'
import {
  generateDoctorKeyPair,
  canonicalizePrescriptionData,
  canonicalizeRecordData,
  signPrescription,
  hashPrescriptionData,
  generateVerifyToken,
} from '@/lib/prescription-signing'

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

  if (!record || record.uploadedBy !== session.user.id) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (record.ocrStatus !== 'done') {
    return NextResponse.json(
      { error: 'Cannot sign record before OCR completes' },
      { status: 400 },
    )
  }

  if (record.signatureStatus === 'signed') {
    return NextResponse.json(
      { error: 'Record is already signed' },
      { status: 409 },
    )
  }

  // Get or create doctor's keypair
  let keyPair = await prisma.doctorKeyPair.findUnique({
    where: { userId: session.user.id },
  })

  if (!keyPair) {
    const { publicKey, privateKey } = generateDoctorKeyPair()
    keyPair = await prisma.doctorKeyPair.create({
      data: {
        userId: session.user.id,
        publicKey,
        encryptedPrivateKey: encrypt(privateKey),
      },
    })
  }

  // Sign the prescription data
  const privateKeyHex = decrypt(keyPair.encryptedPrivateKey)
  const canonicalData = record.ocrEngine === 'llm_direct'
    ? canonicalizeRecordData((record.ocrData as Record<string, unknown>) ?? {})
    : canonicalizePrescriptionData((record.ocrData as Record<string, unknown>) ?? {})
  const signature = signPrescription(canonicalData, privateKeyHex)
  const dataHash = hashPrescriptionData(canonicalData)
  const verifyToken = generateVerifyToken()
  const signedAt = new Date()

  await prisma.$transaction([
    prisma.medicalRecord.update({
      where: { id },
      data: {
        signatureStatus: 'signed',
        digitalSignature: signature,
        signedAt,
        signedById: session.user.id,
        signedDataHash: dataHash,
        verifyToken,
      },
    }),
  ])

  await createAuditLog({
    userId: session.user.id,
    action: 'SIGN_PRESCRIPTION',
    resourceType: 'MedicalRecord',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    metadata: { algorithm: 'Ed25519', signedDataHash: dataHash },
  })

  const baseUrl = process.env.AUTH_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/verify/${id}?token=${verifyToken}`

  return NextResponse.json({ success: true, signedAt, verifyUrl })
}

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { uploadRecord } from '@/lib/minio'
import { ocrQueue } from '@/lib/queue'
import {
  uploadRecordSchema,
  MAX_FILE_SIZE,
  ACCEPTED_MIME_TYPES,
} from '@/lib/validations/medical-record'

function hammingDistance(a: string, b: string): number {
  let dist = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    let bits = xor
    while (bits) {
      dist += bits & 1
      bits >>= 1
    }
  }
  return dist
}

/** Check if crop-resistant hashes share any segment match */
function cropHashesMatch(a: string, b: string): boolean {
  // crop_resistant_hash produces comma-separated segment hashes
  const segsA = a.split(',').filter(Boolean)
  const segsB = b.split(',').filter(Boolean)
  for (const sa of segsA) {
    for (const sb of segsB) {
      if (sa.length === sb.length) {
        const dist = hammingDistance(sa, sb)
        // Each segment is 64-bit (16 hex), threshold of 10
        if (dist <= 10) return true
      }
    }
  }
  return false
}

interface DuplicateMatch {
  recordId: string
  similarity: number
  method: 'phash' | 'crop_resistant'
}

function findDuplicate(
  phash: string | null,
  crhash: string | null,
  existing: { record_id: string; phash: string | null; crhash: string | null }[],
  threshold: number,
): DuplicateMatch | null {
  for (const row of existing) {
    // Check standard pHash
    if (phash && row.phash && phash.length === row.phash.length) {
      const dist = hammingDistance(phash, row.phash)
      if (dist <= threshold) {
        const maxBits = phash.length * 4
        return {
          recordId: row.record_id,
          similarity: Math.round((1 - dist / maxBits) * 100),
          method: 'phash',
        }
      }
    }
    // Check crop-resistant hash
    if (crhash && row.crhash && cropHashesMatch(crhash, row.crhash)) {
      return {
        recordId: row.record_id,
        similarity: 95, // crop-resistant match implies high similarity
        method: 'crop_resistant',
      }
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!session.user.institutionId) {
    return NextResponse.json(
      { error: 'Doctor must belong to an institution' },
      { status: 403 },
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const patientId = formData.get('patientId') as string | null
  const recordType = (formData.get('recordType') as string | null) || undefined
  const useAiExtraction = formData.get('useAiExtraction') === 'true'
  const allowDuplicate = formData.get('allowDuplicate') === 'true'

  // Validate fields
  const parsed = uploadRecordSchema.safeParse({ patientId, recordType, useAiExtraction })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Validate file
  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: 'Only JPEG and PNG images are accepted' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size exceeds 10MB limit' },
      { status: 413 },
    )
  }

  // Verify doctor owns this patient
  const patient = await prisma.patient.findUnique({
    where: { id: parsed.data.patientId },
    select: { registeredBy: true },
  })

  if (!patient || patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Sharp: resize max 2048px, convert to PNG
  const arrayBuffer = await file.arrayBuffer()
  const pngBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  // Compute hashes via OCR service
  const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? 'http://localhost:8000'
  let phash: string | null = null
  let crhash: string | null = null
  try {
    const hashForm = new FormData()
    hashForm.append('file', new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }), 'image.png')
    const hashRes = await fetch(`${OCR_SERVICE_URL}/dedup/hash`, {
      method: 'POST',
      body: hashForm,
    })
    if (hashRes.ok) {
      const hashData = await hashRes.json()
      phash = hashData.phash ?? null
      crhash = hashData.crhash ?? null
    }
  } catch {
    console.warn('[dedup] Hash computation failed, skipping dedup check')
  }

  // Check for duplicates
  if ((phash || crhash) && !allowDuplicate) {
    const PHASH_THRESHOLD = parseInt(process.env.PHASH_THRESHOLD ?? '10')
    const existing = await prisma.$queryRaw<{ record_id: string; phash: string | null; crhash: string | null }[]>`
      SELECT record_id, phash, crhash FROM image_hashes WHERE phash IS NOT NULL OR crhash IS NOT NULL
    `
    const match = findDuplicate(phash, crhash, existing, PHASH_THRESHOLD)
    if (match) {
      // Return duplicate info — frontend must confirm before proceeding
      return NextResponse.json({
        duplicateDetected: true,
        similarity: match.similarity,
        method: match.method,
        duplicateRecordId: match.recordId,
      }, { status: 409 })
    }
  }

  // Create record
  const record = await prisma.medicalRecord.create({
    data: {
      patientId: parsed.data.patientId,
      uploadedBy: session.user.id,
      institutionId: session.user.institutionId,
      imageUrl: '',
      ocrStatus: 'pending',
      recordType: parsed.data.useAiExtraction ? null : (parsed.data.recordType ?? null),
      ocrEngine: parsed.data.useAiExtraction ? 'llm_direct' : undefined,
      isDuplicate: allowDuplicate,
    },
  })

  // Upload to MinIO
  const minioKey = await uploadRecord(
    parsed.data.patientId,
    record.id,
    pngBuffer,
    'image/png',
  )

  // Update record with actual MinIO key
  await prisma.medicalRecord.update({
    where: { id: record.id },
    data: { imageUrl: minioKey },
  })

  // Store hashes
  if (phash || crhash) {
    await prisma.imageHash.create({
      data: {
        recordId: record.id,
        phash,
        crhash,
      },
    })
  }

  // Enqueue OCR job
  await ocrQueue.add('ocr', {
    recordId: record.id,
    minioKey,
    ...(parsed.data.useAiExtraction && { mode: 'llm_direct' as const }),
  })

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    action: 'UPLOAD_RECORD',
    resourceType: 'MedicalRecord',
    resourceId: record.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json({
    id: record.id,
    ocrStatus: 'pending',
  }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
  }

  // Verify doctor owns this patient
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { registeredBy: true },
  })

  if (!patient || patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const records = await prisma.medicalRecord.findMany({
    where: { patientId },
    select: {
      id: true,
      recordType: true,
      ocrStatus: true,
      ocrEngine: true,
      ocrConfidence: true,
      isDuplicate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(records)
}

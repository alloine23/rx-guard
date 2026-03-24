import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MAX_FILE_SIZE, ACCEPTED_MIME_TYPES } from '@/lib/validations/medical-record'

function hammingDistance(a: string, b: string): number {
  let dist = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    let bits = xor
    while (bits) { dist += bits & 1; bits >>= 1 }
  }
  return dist
}

function cropHashesMatch(a: string, b: string): boolean {
  const segsA = a.split(',').filter(Boolean)
  const segsB = b.split(',').filter(Boolean)
  for (const sa of segsA) {
    for (const sb of segsB) {
      if (sa.length === sb.length) {
        if (hammingDistance(sa, sb) <= 10) return true
      }
    }
  }
  return false
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return NextResponse.json({ error: 'Only JPEG and PNG images are accepted' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 413 })
  }

  // Resize like the upload route does
  const arrayBuffer = await file.arrayBuffer()
  const pngBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  // Compute hashes
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
    // Hash computation failed — no duplicates detectable
    return NextResponse.json({ duplicateDetected: false })
  }

  if (!phash && !crhash) {
    return NextResponse.json({ duplicateDetected: false })
  }

  // Check against existing
  const PHASH_THRESHOLD = parseInt(process.env.PHASH_THRESHOLD ?? '10')
  const existing = await prisma.$queryRaw<{ record_id: string; phash: string | null; crhash: string | null }[]>`
    SELECT record_id, phash, crhash FROM image_hashes WHERE phash IS NOT NULL OR crhash IS NOT NULL
  `

  for (const row of existing) {
    if (phash && row.phash && phash.length === row.phash.length) {
      const dist = hammingDistance(phash, row.phash)
      if (dist <= PHASH_THRESHOLD) {
        const maxBits = phash.length * 4
        return NextResponse.json({
          duplicateDetected: true,
          similarity: Math.round((1 - dist / maxBits) * 100),
          method: 'phash',
          duplicateRecordId: row.record_id,
        })
      }
    }
    if (crhash && row.crhash && cropHashesMatch(crhash, row.crhash)) {
      return NextResponse.json({
        duplicateDetected: true,
        similarity: 95,
        method: 'crop_resistant',
        duplicateRecordId: row.record_id,
      })
    }
  }

  return NextResponse.json({ duplicateDetected: false })
}

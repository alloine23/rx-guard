import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRecordBuffer } from '@/lib/minio'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    select: { imageUrl: true, patientId: true, uploadedBy: true, patient: { select: { userId: true } } },
  })

  if (!record || !record.imageUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Access control: doctor who uploaded, the patient themselves, or pharmacist with consent (handled by caller)
  const role = session.user.role
  const allowed =
    role === 'superadmin' ||
    (role === 'doctor' && record.uploadedBy === session.user.id) ||
    (role === 'patient' && record.patient.userId === session.user.id) ||
    role === 'pharmacist' || // consent check happens at the page level
    role === 'admin'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const buffer = await getRecordBuffer(record.imageUrl)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=900',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}

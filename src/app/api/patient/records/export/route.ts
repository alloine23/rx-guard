import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRecordBuffer } from '@/lib/minio'
import JSZip from 'jszip'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const records = await prisma.medicalRecord.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'desc' },
  })

  if (records.length === 0) {
    return NextResponse.json({ error: 'No records to export' }, { status: 404 })
  }

  const zip = new JSZip()

  for (const record of records) {
    if (record.imageUrl) {
      try {
        const buffer = await getRecordBuffer(record.imageUrl)
        const type = record.recordType?.replace(/_/g, '-') ?? 'general'
        const date = record.createdAt.toISOString().split('T')[0]
        const ext = record.imageUrl.split('.').pop() ?? 'png'
        zip.file(`${type}_${date}_${record.id.slice(0, 8)}.${ext}`, buffer)
      } catch {
        // Skip files that can't be downloaded
      }
    }
  }

  const summary = records.map((r) => ({
    id: r.id,
    recordType: r.recordType,
    ocrStatus: r.ocrStatus,
    ocrEngine: r.ocrEngine,
    ocrConfidence: r.ocrConfidence,
    ocrData: r.ocrData,
    createdAt: r.createdAt,
  }))
  zip.file('summary.json', JSON.stringify(summary, null, 2))

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="rxguard-records-${patient.patientCode}.zip"`,
    },
  })
}

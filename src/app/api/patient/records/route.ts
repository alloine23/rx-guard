import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
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

  const records = await prisma.medicalRecord.findMany({
    where: { patientId: patient.id },
    select: {
      id: true,
      recordType: true,
      ocrStatus: true,
      ocrConfidence: true,
      createdAt: true,
      institution: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(records)
}

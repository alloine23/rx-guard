import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ patientCode: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { patientCode } = await params

  const patient = await prisma.patient.findUnique({
    where: { patientCode },
    include: {
      records: {
        select: {
          id: true,
          ocrStatus: true,
          ocrEngine: true,
          ocrConfidence: true,
          recordType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  if (patient.registeredBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    ...patient,
    fullName: decrypt(patient.fullName),
    dateOfBirth: decrypt(patient.dateOfBirth),
    phone: patient.phone ? decrypt(patient.phone) : null,
    email: patient.email ? decrypt(patient.email) : null,
  })
}

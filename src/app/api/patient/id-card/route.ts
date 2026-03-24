import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function GET() {
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

  return NextResponse.json({
    patientCode: patient.patientCode,
    fullName: decrypt(patient.fullName),
    dateOfBirth: decrypt(patient.dateOfBirth),
    phone: patient.phone ? decrypt(patient.phone) : null,
    photoUrl: patient.photoUrl,
  })
}

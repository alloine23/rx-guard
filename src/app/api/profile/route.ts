import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/crypto'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      institution: { select: { id: true, name: true, type: true, location: true } },
      patientProfile: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const profile: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    institution: user.institution,
  }

  if (user.patientProfile) {
    profile.patient = {
      patientCode: user.patientProfile.patientCode,
      fullName: decrypt(user.patientProfile.fullName),
      dateOfBirth: decrypt(user.patientProfile.dateOfBirth),
      phone: user.patientProfile.phone ? decrypt(user.patientProfile.phone) : null,
      email: user.patientProfile.email ? decrypt(user.patientProfile.email) : null,
    }
  }

  return NextResponse.json(profile)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (session.user.role === 'patient') {
    const patient = await prisma.patient.findUnique({
      where: { userId: session.user.id },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.phone !== undefined) {
      updateData.phone = body.phone ? encrypt(body.phone) : null
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: updateData,
      })
    }
  }

  return NextResponse.json({ message: 'Profile updated' })
}

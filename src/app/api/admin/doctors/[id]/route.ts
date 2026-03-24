import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const doctor = await prisma.user.findUnique({
    where: { id, role: 'doctor' },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
      institution: { select: { id: true, name: true } },
    },
  })

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  // Admin can only see doctors in their own institution
  if (session.user.role === 'admin' && doctor.institution?.id !== session.user.institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(doctor)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const doctor = await prisma.user.findUnique({
    where: { id, role: 'doctor' },
    select: { id: true, institutionId: true },
  })

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  if (session.user.role === 'admin' && doctor.institutionId !== session.user.institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (typeof body.isActive === 'boolean') {
    updateData.isActive = body.isActive
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, isActive: true, createdAt: true },
  })

  await createAuditLog({
    userId: session.user.id,
    action: body.isActive ? 'ACTIVATE_DOCTOR' : 'DEACTIVATE_DOCTOR',
    resourceType: 'User',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!session.user.institutionId) {
    return NextResponse.json(
      { error: 'Admin must belong to an institution' },
      { status: 400 }
    )
  }

  const { id } = await params

  const doctor = await prisma.user.findUnique({ where: { id } })
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  if (doctor.role !== 'doctor' || doctor.institutionId !== session.user.institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check for domain activity that blocks deletion
  const [patientCount, recordCount] = await Promise.all([
    prisma.patient.count({ where: { registeredBy: id } }),
    prisma.medicalRecord.count({ where: { uploadedBy: id } }),
  ])

  if (patientCount > 0 || recordCount > 0) {
    const reasons: string[] = []
    if (patientCount > 0) reasons.push(`${patientCount} registered patient${patientCount > 1 ? 's' : ''}`)
    if (recordCount > 0) reasons.push(`${recordCount} medical record${recordCount > 1 ? 's' : ''}`)
    return NextResponse.json(
      { error: `Cannot delete doctor with ${reasons.join(' and ')}` },
      { status: 409 }
    )
  }

  // Clean up system records, then delete user
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.auditLog.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  await createAuditLog({
    userId: session.user.id,
    action: 'DELETE_DOCTOR',
    resourceType: 'User',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    metadata: { email: doctor.email },
  })

  return NextResponse.json({ message: 'Doctor deleted' })
}

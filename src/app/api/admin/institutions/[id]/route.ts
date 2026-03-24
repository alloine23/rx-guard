import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { updateInstitutionSchema } from '@/lib/validations/institution'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const institution = await prisma.institution.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'admin' },
        select: {
          id: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      },
      _count: {
        select: { users: true, records: true, patientConsents: true },
      },
    },
  })

  if (!institution) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }

  return NextResponse.json(institution)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.institution.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateInstitutionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const institution = await prisma.institution.update({
    where: { id },
    data: parsed.data,
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'UPDATE_INSTITUTION',
    resourceType: 'institution',
    resourceId: institution.id,
    metadata: { changes: parsed.data },
  })

  return NextResponse.json(institution)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.institution.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }

  await prisma.institution.delete({ where: { id } })

  await createAuditLog({
    userId: session.user.id,
    action: 'DELETE_INSTITUTION',
    resourceType: 'institution',
    resourceId: id,
    metadata: { name: existing.name },
  })

  return NextResponse.json({ message: 'Institution deleted' })
}

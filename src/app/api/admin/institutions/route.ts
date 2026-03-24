import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createInstitutionSchema } from '@/lib/validations/institution'

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const institutions = await prisma.institution.findMany({
    include: {
      _count: {
        select: { users: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(institutions)
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createInstitutionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const institution = await prisma.institution.create({
    data: parsed.data,
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'CREATE_INSTITUTION',
    resourceType: 'institution',
    resourceId: institution.id,
    metadata: { name: institution.name, type: institution.type },
  })

  return NextResponse.json(institution, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { ids } = body as { ids: string[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
  }

  await prisma.institution.deleteMany({
    where: { id: { in: ids } },
  })

  for (const id of ids) {
    await createAuditLog({
      userId: session.user.id,
      action: 'DELETE_INSTITUTION',
      resourceType: 'institution',
      resourceId: id,
    })
  }

  return NextResponse.json({ deleted: ids.length })
}

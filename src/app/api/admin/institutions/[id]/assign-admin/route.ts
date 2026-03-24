import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { assignAdminSchema } from '@/lib/validations/institution'

export async function POST(
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

  const institution = await prisma.institution.findUnique({ where: { id } })
  if (!institution) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = assignAdminSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })

  if (existingUser) {
    return NextResponse.json(
      { error: 'Email already taken' },
      { status: 409 }
    )
  }

  const passwordHash = await hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: 'admin',
      institutionId: id,
      forcePasswordChange: true,
    },
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'ASSIGN_ADMIN',
    resourceType: 'user',
    resourceId: user.id,
    metadata: {
      email: user.email,
      institutionId: id,
      institutionName: institution.name,
    },
  })

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
      createdAt: user.createdAt,
    },
    { status: 201 }
  )
}

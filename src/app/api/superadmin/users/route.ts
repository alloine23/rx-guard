import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const roleFilter = searchParams.get('role')
  const search = searchParams.get('search')

  const users = await prisma.user.findMany({
    where: {
      ...(roleFilter && roleFilter !== 'all' ? { role: roleFilter as any } : {}),
      ...(search
        ? { email: { contains: search, mode: 'insensitive' as const } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      forcePasswordChange: true,
      createdAt: true,
      institution: {
        select: { id: true, name: true, type: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(users)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, isActive } = body as { userId: string; isActive: boolean }

  if (!userId || typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Prevent deactivating yourself
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot deactivate your own account' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  })

  await createAuditLog({
    userId: session.user.id,
    action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    resourceType: 'User',
    resourceId: userId,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json(updated)
}

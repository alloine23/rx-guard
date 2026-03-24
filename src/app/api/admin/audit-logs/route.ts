import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'superadmin' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}

  if (action) {
    where.action = action
  }

  if (from || to) {
    const createdAt: Record<string, Date> = {}
    if (from) createdAt.gte = new Date(from)
    if (to) createdAt.lte = new Date(to)
    where.createdAt = createdAt
  }

  // Admin can only see logs for users in their institution
  if (session.user.role === 'admin') {
    if (!session.user.institutionId) {
      return NextResponse.json(
        { error: 'Admin must belong to an institution' },
        { status: 400 }
      )
    }
    where.user = {
      institutionId: session.user.institutionId,
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      userId: true,
      action: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(logs)
}

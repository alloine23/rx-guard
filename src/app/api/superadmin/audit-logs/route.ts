import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const institutionId = searchParams.get('institutionId')

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

  if (institutionId) {
    where.user = { institutionId }
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
          institution: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(logs)
}

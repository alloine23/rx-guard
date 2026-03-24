import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const hospitals = await prisma.institution.findMany({
    where: { type: 'hospital' },
    select: { id: true, name: true, location: true },
    orderBy: { name: 'asc' },
    take: 100,
  })

  return NextResponse.json(hospitals)
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')

  const consents = await prisma.consent.findMany({
    where: {
      hospitalId: session.user.institutionId,
      ...(statusFilter === 'all' ? {} : { status: 'pending' as const }),
    },
    include: {
      patient: {
        select: {
          patientCode: true,
          fullName: true,
        },
      },
    },
  })

  const decrypted = consents.map((consent) => ({
    ...consent,
    patient: {
      ...consent.patient,
      fullName: decrypt(consent.patient.fullName),
    },
  }))

  return NextResponse.json(decrypted)
}

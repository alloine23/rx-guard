import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { patientConsentActionSchema } from '@/lib/validations/consent'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = patientConsentActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const consent = await prisma.consent.findUnique({ where: { id } })
  if (!consent) {
    return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
  }

  if (consent.patientId !== patient.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action } = parsed.data

  if (action === 'revoke') {
    if (consent.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved consents can be revoked' },
        { status: 400 }
      )
    }

    const updated = await prisma.consent.update({
      where: { id },
      data: { status: 'revoked', revokedAt: new Date() },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'REVOKE_CONSENT',
      resourceType: 'Consent',
      resourceId: id,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    })

    return NextResponse.json(updated)
  }

  if (action === 'cancel') {
    if (consent.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending consents can be cancelled' },
        { status: 400 }
      )
    }

    await prisma.consent.delete({ where: { id } })

    await createAuditLog({
      userId: session.user.id,
      action: 'CANCEL_CONSENT',
      resourceType: 'Consent',
      resourceId: id,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    })

    return NextResponse.json({ deleted: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

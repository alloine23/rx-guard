// src/app/api/patient/consents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { grantConsentSchema } from '@/lib/validations/consent'
import { sendEmail } from '@/lib/email'
import { createNotificationsForRole } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'

export async function GET() {
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

  const consents = await prisma.consent.findMany({
    where: { patientId: patient.id },
    include: {
      hospital: {
        select: { id: true, name: true, location: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(consents)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { allowed } = await rateLimit(`consent:${session.user.id}`, 10, 3600)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many consent requests. Try again later.' }, { status: 429 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = grantConsentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { hospitalId, expiresAt } = parsed.data

  // Verify hospital exists and is of type 'hospital'
  const hospital = await prisma.institution.findUnique({
    where: { id: hospitalId },
  })
  if (!hospital || hospital.type !== 'hospital') {
    return NextResponse.json({ error: 'Hospital not found' }, { status: 404 })
  }

  // Check for existing active consent
  const existing = await prisma.consent.findFirst({
    where: {
      patientId: patient.id,
      hospitalId,
      status: { in: ['pending', 'approved'] },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'An active or pending consent already exists for this hospital' },
      { status: 409 }
    )
  }

  const consent = await prisma.consent.create({
    data: {
      patientId: patient.id,
      hospitalId,
      status: 'pending',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      hospital: {
        select: { id: true, name: true, location: true },
      },
    },
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'GRANT_CONSENT',
    resourceType: 'Consent',
    resourceId: consent.id,
    ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
  })

  // Fire-and-forget: notify hospital admins of new consent request
  ;(async () => {
    const admins = await prisma.user.findMany({
      where: { institutionId: hospitalId, role: 'admin', isActive: true },
      select: { email: true },
    })
    const patientEmail = session.user.email
    for (const admin of admins) {
      sendEmail({
        to: admin.email,
        subject: 'New Consent Request — RxGuard',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
            <h2 style="color: #0d9488;">New Consent Request</h2>
            <p>A patient (<strong>${patientEmail}</strong>) has submitted a consent request for <strong>${hospital.name}</strong>.</p>
            <p>Please review the request in your admin dashboard.</p>
            <p style="color: #6b7280; font-size: 14px;">— RxGuard</p>
          </div>
        `,
      }).catch((err) => console.error('[email-error] new-consent-admin', err))
    }
  })().catch((err) => console.error('[email-error] new-consent', err))

  // Fire-and-forget: in-app notification for hospital admins
  createNotificationsForRole('admin', hospitalId, 'CONSENT_REQUESTED', {
    patientEmail: session.user.email,
  }).catch((err) => console.error('[notification-error] consent-requested', err))

  return NextResponse.json(consent, { status: 201 })
}

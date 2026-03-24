import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createDoctorSchema } from '@/lib/validations/user'
import { hash } from 'bcryptjs'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

export async function GET() {
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

  const doctors = await prisma.user.findMany({
    where: {
      role: 'doctor',
      institutionId: session.user.institutionId,
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json(doctors)
}

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const parsed = createDoctorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Email already in use' },
      { status: 409 }
    )
  }

  const passwordHash = await hash(parsed.data.password, 12)

  const doctor = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: 'doctor',
      institutionId: session.user.institutionId,
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'REGISTER_DOCTOR',
    resourceType: 'User',
    resourceId: doctor.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  // Fire-and-forget welcome email with credentials
  ;(async () => {
    const institution = await prisma.institution.findUnique({
      where: { id: session.user.institutionId! },
      select: { name: true },
    })
    const loginUrl = process.env.NEXTAUTH_URL || 'https://rxguard.local'
    await sendEmail({
      to: parsed.data.email,
      subject: 'Welcome to RxGuard — Doctor Account Created',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0d9488;">Welcome to RxGuard</h2>
          <p>A doctor account has been created for you at <strong>${institution?.name || 'your institution'}</strong>.</p>
          <p><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #0d9488;">${loginUrl}</a></p>
          <p><strong>Email:</strong> ${parsed.data.email}</p>
          <p><strong>Password:</strong> ${parsed.data.password}</p>
          <p>Please log in and change your password immediately.</p>
          <p style="color: #6b7280; font-size: 14px;">— RxGuard</p>
        </div>
      `,
    })
  })().catch((err) => console.error('[email-error] doctor-welcome', err))

  // Fire-and-forget: in-app welcome notification
  ;(async () => {
    const inst = await prisma.institution.findUnique({
      where: { id: session.user.institutionId! },
      select: { name: true },
    })
    await createNotification({
      userId: doctor.id,
      type: 'WELCOME',
      payload: { institutionName: inst?.name || 'your institution' },
    })
  })().catch((err) => console.error('[notification-error] doctor-welcome', err))

  return NextResponse.json(doctor, { status: 201 })
}

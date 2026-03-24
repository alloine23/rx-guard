import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const body = await req.json()
  const { action } = body as { action: string }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'Action must be "approve" or "reject"' },
      { status: 400 }
    )
  }

  const consent = await prisma.consent.findUnique({
    where: { id },
    include: {
      patient: { include: { user: { select: { email: true } } } },
      hospital: { select: { name: true } },
    },
  })
  if (!consent) {
    return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
  }

  if (consent.hospitalId !== session.user.institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let updated
  if (action === 'approve') {
    updated = await prisma.consent.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: session.user.id,
        grantedAt: new Date(),
      },
    })
  } else {
    updated = await prisma.consent.update({
      where: { id },
      data: {
        status: 'rejected',
        revokedAt: new Date(),
        rejectionReason: body.rejectionReason || null,
      },
    })
  }

  await createAuditLog({
    userId: session.user.id,
    action: action === 'approve' ? 'APPROVE_CONSENT' : 'REJECT_CONSENT',
    resourceType: 'Consent',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  const patientEmail = consent.patient.user.email
  const hospitalName = consent.hospital.name
  if (action === 'approve') {
    sendEmail({
      to: patientEmail,
      subject: 'Consent Approved — RxGuard',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0d9488;">Consent Approved</h2>
          <p>Your consent request for <strong>${hospitalName}</strong> has been approved.</p>
          <p>Your medical records can now be accessed by authorized pharmacists.</p>
          <p style="color: #6b7280; font-size: 14px;">— RxGuard</p>
        </div>
      `,
    }).catch((err) => console.error('[email-error] consent-approved', err))

    createNotification({
      userId: consent.patient.userId,
      type: 'CONSENT_APPROVED',
      payload: { hospitalName },
    }).catch((err) => console.error('[notification-error] consent-approved', err))
  } else {
    const reason = body.rejectionReason
      ? `<p><strong>Reason:</strong> ${body.rejectionReason}</p>`
      : ''
    sendEmail({
      to: patientEmail,
      subject: 'Consent Rejected — RxGuard',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0d9488;">Consent Rejected</h2>
          <p>Your consent request for <strong>${hospitalName}</strong> has been rejected.</p>
          ${reason}
          <p>You may submit a new request if needed.</p>
          <p style="color: #6b7280; font-size: 14px;">— RxGuard</p>
        </div>
      `,
    }).catch((err) => console.error('[email-error] consent-rejected', err))

    createNotification({
      userId: consent.patient.userId,
      type: 'CONSENT_REJECTED',
      payload: { hospitalName, reason: body.rejectionReason },
    }).catch((err) => console.error('[notification-error] consent-rejected', err))
  }

  return NextResponse.json(updated)
}

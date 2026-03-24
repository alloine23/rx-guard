import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { updateVerificationSchema } from '@/lib/validations/verification'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'pharmacist') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { institutionId } = session.user
  if (!institutionId) {
    return NextResponse.json(
      { error: 'Pharmacist must belong to an institution' },
      { status: 400 }
    )
  }

  const { id } = await params

  const body = await req.json()
  const parsed = updateVerificationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { action, rejectionReason } = parsed.data

  const verification = await prisma.prescriptionVerification.findUnique({
    where: { id },
    include: {
      pharmacist: { select: { institutionId: true } },
      record: {
        select: {
          uploadedBy: true,
          uploader: { select: { email: true } },
          institution: { select: { name: true } },
        },
      },
    },
  })

  if (!verification) {
    return NextResponse.json(
      { error: 'Verification not found' },
      { status: 404 }
    )
  }

  if (verification.pharmacist.institutionId !== institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (verification.status !== 'verified') {
    return NextResponse.json(
      {
        error: `Cannot ${action} a prescription that is not in 'verified' state`,
      },
      { status: 400 }
    )
  }

  let updated
  if (action === 'dispense') {
    updated = await prisma.prescriptionVerification.update({
      where: { id },
      data: {
        status: 'dispensed',
        dispensedAt: new Date(),
      },
    })
  } else {
    updated = await prisma.prescriptionVerification.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason,
      },
    })
  }

  await createAuditLog({
    userId: session.user.id,
    action: action === 'dispense' ? 'DISPENSE_PRESCRIPTION' : 'REJECT_PRESCRIPTION',
    resourceType: 'PrescriptionVerification',
    resourceId: id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  // Fire-and-forget email notification to uploading doctor
  const doctorEmail = verification.record.uploader.email
  const institutionName = verification.record.institution.name
  if (action === 'dispense') {
    sendEmail({
      to: doctorEmail,
      subject: 'Prescription Dispensed — RxGuard',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0d9488;">Prescription Dispensed</h2>
          <p>A prescription you uploaded has been dispensed by <strong>${institutionName}</strong>.</p>
          <p><strong>Verification ID:</strong> ${id}</p>
          <p style="color: #6b7280; font-size: 14px;">— RxGuard</p>
        </div>
      `,
    }).catch((err) => console.error('[email-error] prescription-dispensed', err))

    createNotification({
      userId: verification.record.uploadedBy,
      type: 'PRESCRIPTION_DISPENSED',
      payload: { recordId: verification.recordId },
    }).catch((err) => console.error('[notification-error] prescription-dispensed', err))
  } else {
    sendEmail({
      to: doctorEmail,
      subject: 'Prescription Rejected — RxGuard',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0d9488;">Prescription Rejected</h2>
          <p>A prescription you uploaded has been rejected by <strong>${institutionName}</strong>.</p>
          ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
          <p><strong>Verification ID:</strong> ${id}</p>
          <p style="color: #6b7280; font-size: 14px;">— RxGuard</p>
        </div>
      `,
    }).catch((err) => console.error('[email-error] prescription-rejected', err))

    createNotification({
      userId: verification.record.uploadedBy,
      type: 'PRESCRIPTION_REJECTED',
      payload: { recordId: verification.recordId, reason: rejectionReason },
    }).catch((err) => console.error('[notification-error] prescription-rejected', err))
  }

  return NextResponse.json(updated)
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { ids, action, rejectionReason } = body as {
    ids: string[]
    action: 'approve' | 'reject'
    rejectionReason?: string
  }

  if (!Array.isArray(ids) || ids.length === 0 || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const updateData = action === 'approve'
    ? { status: 'approved' as const, approvedBy: session.user.id, grantedAt: new Date() }
    : { status: 'rejected' as const, revokedAt: new Date(), rejectionReason: rejectionReason || null }

  const where: Record<string, unknown> = { id: { in: ids }, status: 'pending' }
  if (session.user.role === 'admin' && session.user.institutionId) {
    where.hospitalId = session.user.institutionId
  }

  const result = await prisma.consent.updateMany({ where, data: updateData })

  const updatedConsents = await prisma.consent.findMany({
    where: { id: { in: ids } },
    include: {
      patient: { include: { user: { select: { id: true, email: true } } } },
      hospital: { select: { name: true } },
    },
  })

  ;(async () => {
    for (const consent of updatedConsents) {
      await createAuditLog({
        userId: session.user.id,
        action: action === 'approve' ? 'APPROVE_CONSENT' : 'REJECT_CONSENT',
        resourceType: 'Consent',
        resourceId: consent.id,
        ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
      })

      const patientUserId = consent.patient?.user?.id
      const patientEmail = consent.patient?.user?.email
      const hospitalName = consent.hospital?.name ?? 'Unknown Hospital'

      if (patientUserId) {
        createNotification({
          userId: patientUserId,
          type: action === 'approve' ? 'CONSENT_APPROVED' : 'CONSENT_REJECTED',
          payload: { hospitalName, reason: rejectionReason },
        }).catch(() => {})
      }

      if (patientEmail) {
        const statusText = action === 'approve' ? 'approved' : 'rejected'
        sendEmail({
          to: patientEmail,
          subject: `Consent ${statusText} — RxGuard`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
              <h2 style="color: #0d9488;">Consent ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h2>
              <p>Your consent request for <strong>${hospitalName}</strong> has been <strong>${statusText}</strong>.</p>
              ${action === 'reject' && rejectionReason ? `<p>Reason: ${rejectionReason}</p>` : ''}
              <p style="color: #9ca3af; font-size: 11px;">RxGuard — Computer Vision-Based EHR System</p>
            </div>
          `,
        }).catch(() => {})
      }
    }
  })().catch(() => {})

  return NextResponse.json({ updated: result.count })
}

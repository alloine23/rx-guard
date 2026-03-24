import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { forgotPasswordSchema } from '@/lib/validations/user'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const { allowed } = await rateLimit(`forgot-pwd:${ip}`, 5, 900)
  if (!allowed) {
    return NextResponse.json(
      { message: 'If an account with that email exists, a reset link has been sent.' },
    )
  }

  const body = await req.json()
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const successResponse = NextResponse.json({
    message: 'If an account with that email exists, a reset link has been sent.',
  })

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })

  if (!user || !user.isActive) return successResponse

  const rawToken = randomBytes(32).toString('hex')
  const hashedToken = await hash(rawToken, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: new Date(Date.now() + 30 * 60 * 1000),
    },
  })

  const resetUrl = `${process.env.AUTH_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`

  try {
    await sendEmail({
      to: user.email,
      subject: 'RxGuard — Password Reset',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #0d9488; margin-bottom: 8px;">Password Reset</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password.
            This link expires in <strong>30 minutes</strong>.
          </p>
          <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 32px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Reset Password
          </a>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px;">RxGuard — Computer Vision-Based EHR System</p>
        </div>
      `,
    })
  } catch {
    console.error('[forgot-password] Failed to send reset email')
  }

  return successResponse
}

import { NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { resetPasswordSchema } from '@/lib/validations/user'

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { token, password } = parsed.data
  const url = new URL(req.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (
    !user ||
    !user.resetToken ||
    !user.resetTokenExpiry ||
    user.resetTokenExpiry < new Date()
  ) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 },
    )
  }

  const tokenValid = await compare(token, user.resetToken)
  if (!tokenValid) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 },
    )
  }

  const passwordHash = await hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
      forcePasswordChange: false,
    },
  })

  await createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET',
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ message: 'Password reset successfully.' })
}

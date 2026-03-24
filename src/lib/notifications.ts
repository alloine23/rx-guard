import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface CreateNotificationInput {
  userId: string
  type: string
  payload?: Record<string, unknown>
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  })
}

export async function createNotificationsForRole(
  role: string,
  institutionId: string | null,
  type: string,
  payload?: Record<string, unknown>,
) {
  const where: Record<string, unknown> = { role, isActive: true }
  if (institutionId) where.institutionId = institutionId
  const users = await prisma.user.findMany({
    where: where as any,
    select: { id: true },
  })
  if (users.length === 0) return
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type,
      payload: (payload ?? {}) as Prisma.InputJsonValue,
    })),
  })
}

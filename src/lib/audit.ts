import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface AuditLogInput {
  userId: string
  action: string
  resourceType?: string
  resourceId?: string
  ipAddress?: string | null
  metadata?: Prisma.InputJsonValue
}

export async function createAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ipAddress: input.ipAddress,
      metadata: input.metadata,
    },
  })
}

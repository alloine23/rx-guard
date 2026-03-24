import { createAuditLog } from '../audit'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'test-id' }),
    },
  },
}))

describe('createAuditLog', () => {
  it('creates an audit log entry', async () => {
    const { prisma } = require('@/lib/prisma')

    await createAuditLog({
      userId: 'user-123',
      action: 'LOGIN',
      resourceType: 'user',
      resourceId: 'user-123',
      ipAddress: '127.0.0.1',
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        action: 'LOGIN',
        resourceType: 'user',
        resourceId: 'user-123',
        ipAddress: '127.0.0.1',
        metadata: undefined,
      },
    })
  })
})

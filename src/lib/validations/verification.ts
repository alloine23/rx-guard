import { z } from 'zod'

export const createVerificationSchema = z.object({
  recordId: z.string().uuid(),
})

export type CreateVerificationInput = z.infer<typeof createVerificationSchema>

export const updateVerificationSchema = z
  .object({
    action: z.enum(['dispense', 'reject']),
    rejectionReason: z.string().min(1).max(500).optional(),
  })
  .refine((data) => data.action !== 'reject' || !!data.rejectionReason, {
    message: 'Rejection reason is required when rejecting',
    path: ['rejectionReason'],
  })

export type UpdateVerificationInput = z.infer<typeof updateVerificationSchema>

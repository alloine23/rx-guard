import { z } from 'zod'

export const grantConsentSchema = z.object({
  hospitalId: z.string().uuid('hospitalId must be a valid UUID'),
  expiresAt: z.string().datetime().optional(),
})

export type GrantConsentInput = z.infer<typeof grantConsentSchema>

export const patientConsentActionSchema = z.object({
  action: z.enum(['revoke', 'cancel']),
})

export type PatientConsentActionInput = z.infer<typeof patientConsentActionSchema>

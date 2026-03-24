import { z } from 'zod'

export const registerPatientSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  phone: z.string().max(20).optional(),
  email: z.email('Valid email is required'),
  photoUrl: z.string().optional(),
})

export type RegisterPatientInput = z.infer<typeof registerPatientSchema>

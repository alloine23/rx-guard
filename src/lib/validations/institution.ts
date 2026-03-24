import { z } from 'zod'

export const createInstitutionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['hospital', 'pharmacy']),
  location: z.string().max(500).optional(),
  credentialsUrl: z.url().optional(),
})

export const updateInstitutionSchema = createInstitutionSchema.partial()

export const assignAdminSchema = z.object({
  email: z.email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>
export type AssignAdminInput = z.infer<typeof assignAdminSchema>

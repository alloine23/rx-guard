import { z } from 'zod'

export const createDoctorSchema = z.object({
  email: z.email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>

export const forgotPasswordSchema = z.object({
  email: z.email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

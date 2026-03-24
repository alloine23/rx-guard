import { z } from 'zod'

export const MedicationSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
})

export const MedicalRecordFieldsSchema = z.object({
  patient_name: z.string().default(''),
  date: z.string().default(''),
  diagnosis: z.string().default(''),
  medications: z.array(MedicationSchema).default([]),
  doctor_name: z.string().default(''),
})

export type MedicalRecordFields = z.infer<typeof MedicalRecordFieldsSchema>

export const DynamicRecordFieldsSchema = z
  .object({ record_type: z.string().min(1) })
  .passthrough()

export const uploadRecordSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  recordType: z.string().max(50).optional(),
  useAiExtraction: z.boolean().default(false),
})

export const correctRecordSchema = z.object({
  ocrData: MedicalRecordFieldsSchema,
})

export const correctDynamicRecordSchema = z.object({
  ocrData: DynamicRecordFieldsSchema,
})

/** Max upload size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Accepted MIME types for upload */
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'] as const

import {
  uploadRecordSchema,
  correctRecordSchema,
  correctDynamicRecordSchema,
  MedicalRecordFieldsSchema,
} from '../medical-record'

describe('uploadRecordSchema', () => {
  it('accepts useAiExtraction boolean', () => {
    const result = uploadRecordSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      useAiExtraction: true,
    })
    expect(result.success).toBe(true)
  })

  it('defaults useAiExtraction to false', () => {
    const result = uploadRecordSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.useAiExtraction).toBe(false)
    }
  })
})

describe('correctDynamicRecordSchema', () => {
  it('accepts freeform JSON with record_type', () => {
    const result = correctDynamicRecordSchema.safeParse({
      ocrData: {
        record_type: 'lab_result',
        patient_name: 'Jane',
        tests: [{ test: 'CBC', value: '5.2' }],
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing record_type', () => {
    const result = correctDynamicRecordSchema.safeParse({
      ocrData: { patient_name: 'Jane' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty record_type', () => {
    const result = correctDynamicRecordSchema.safeParse({
      ocrData: { record_type: '' },
    })
    expect(result.success).toBe(false)
  })
})

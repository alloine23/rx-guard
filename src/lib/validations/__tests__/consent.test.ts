import { grantConsentSchema, patientConsentActionSchema } from '../consent'

describe('grantConsentSchema', () => {
  it('accepts valid UUID hospitalId', () => {
    const result = grantConsentSchema.safeParse({
      hospitalId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })


  it('rejects missing hospitalId', () => {
    const result = grantConsentSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID hospitalId', () => {
    const result = grantConsentSchema.safeParse({ hospitalId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('patientConsentActionSchema', () => {
  it('accepts revoke action', () => {
    const result = patientConsentActionSchema.safeParse({ action: 'revoke' })
    expect(result.success).toBe(true)
  })

  it('accepts cancel action', () => {
    const result = patientConsentActionSchema.safeParse({ action: 'cancel' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = patientConsentActionSchema.safeParse({ action: 'delete' })
    expect(result.success).toBe(false)
  })
})

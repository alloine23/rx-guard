import { generatePatientCode, generateTempPassword } from '../patient-utils'

describe('generatePatientCode', () => {
  it('generates code in format USEP-YYYY-NNNNN', () => {
    const code = generatePatientCode(1)
    expect(code).toMatch(/^USEP-\d{4}-\d{5}$/)
  })

  it('pads sequence number to 5 digits', () => {
    const code = generatePatientCode(42)
    expect(code).toContain('-00042')
  })
})

describe('generateTempPassword', () => {
  it('generates an 8-character password', () => {
    const pwd = generateTempPassword()
    expect(pwd).toHaveLength(8)
  })

  it('generates different passwords each call', () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword())
  })
})

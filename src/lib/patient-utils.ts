import { randomBytes } from 'crypto'

export function generatePatientCode(sequenceNumber: number): string {
  const year = new Date().getFullYear()
  const padded = String(sequenceNumber).padStart(5, '0')
  return `USEP-${year}-${padded}`
}

export function generateTempPassword(): string {
  return randomBytes(4).toString('hex')
}

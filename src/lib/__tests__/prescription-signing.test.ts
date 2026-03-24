import {
  generateDoctorKeyPair,
  canonicalizePrescriptionData,
  canonicalizeRecordData,
  signPrescription,
  verifyPrescription,
  hashPrescriptionData,
  generateVerifyToken,
} from '../prescription-signing'

describe('generateDoctorKeyPair', () => {
  it('returns publicKey and privateKey as hex strings', () => {
    const { publicKey, privateKey } = generateDoctorKeyPair()
    expect(publicKey).toMatch(/^[a-f0-9]{64}$/)
    expect(privateKey).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generates unique keypairs each call', () => {
    const a = generateDoctorKeyPair()
    const b = generateDoctorKeyPair()
    expect(a.publicKey).not.toBe(b.publicKey)
  })
})

describe('canonicalizePrescriptionData', () => {
  it('returns deterministic JSON with sorted keys', () => {
    const data = {
      patient_name: 'Juan',
      doctor_name: 'Dr. Cruz',
      date: '2026-03-14',
      medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: '3x daily' }],
      diagnosis: 'Flu',
      extra_field: 'ignored',
    }
    const result = canonicalizePrescriptionData(data)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed)).toEqual(['date', 'doctor_name', 'medications', 'patient_name', 'record_type'])
    expect(parsed.extra_field).toBeUndefined()
    expect(parsed.diagnosis).toBeUndefined()
    expect(parsed.record_type).toBeNull()
  })

  it('produces same output regardless of input key order', () => {
    const a = { patient_name: 'A', doctor_name: 'B', date: 'C', medications: [] }
    const b = { doctor_name: 'B', date: 'C', patient_name: 'A', medications: [] }
    expect(canonicalizePrescriptionData(a)).toBe(canonicalizePrescriptionData(b))
  })

  it('sorts nested medication objects deterministically', () => {
    const data = {
      medications: [
        { frequency: '3x', name: 'Med', dosage: '500mg' },
      ],
    }
    const result = canonicalizePrescriptionData(data)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed.medications[0])).toEqual(['dosage', 'frequency', 'name'])
  })
})

describe('canonicalizeRecordData (full JSON)', () => {
  it('sorts all keys recursively', () => {
    const data = {
      record_type: 'lab_result',
      patient_name: 'Jane',
      tests: [{ value: '5.2', test: 'CBC' }],
    }
    const result = canonicalizeRecordData(data)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed)).toEqual(['patient_name', 'record_type', 'tests'])
    expect(Object.keys(parsed.tests[0])).toEqual(['test', 'value'])
  })

  it('includes all fields (does not filter)', () => {
    const data = {
      record_type: 'lab_result',
      custom_field: 'included',
      patient_name: 'Test',
    }
    const result = canonicalizeRecordData(data)
    const parsed = JSON.parse(result)
    expect(parsed.custom_field).toBe('included')
  })
})

describe('signPrescription + verifyPrescription', () => {
  it('signs and verifies successfully with matching data', () => {
    const { publicKey, privateKey } = generateDoctorKeyPair()
    const data = canonicalizePrescriptionData({
      patient_name: 'Test',
      doctor_name: 'Dr. Test',
      date: '2026-01-01',
      medications: [],
    })
    const signature = signPrescription(data, privateKey)
    expect(verifyPrescription(data, signature, publicKey)).toBe(true)
  })

  it('fails verification with tampered data', () => {
    const { publicKey, privateKey } = generateDoctorKeyPair()
    const data = canonicalizePrescriptionData({ patient_name: 'Original' })
    const signature = signPrescription(data, privateKey)
    const tampered = canonicalizePrescriptionData({ patient_name: 'Tampered' })
    expect(verifyPrescription(tampered, signature, publicKey)).toBe(false)
  })

  it('fails verification with wrong public key', () => {
    const keyA = generateDoctorKeyPair()
    const keyB = generateDoctorKeyPair()
    const data = canonicalizePrescriptionData({ patient_name: 'Test' })
    const signature = signPrescription(data, keyA.privateKey)
    expect(verifyPrescription(data, signature, keyB.publicKey)).toBe(false)
  })
})

describe('hashPrescriptionData', () => {
  it('returns consistent SHA-256 hex hash', () => {
    const data = 'test data'
    const hash1 = hashPrescriptionData(data)
    const hash2 = hashPrescriptionData(data)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('different data produces different hash', () => {
    expect(hashPrescriptionData('a')).not.toBe(hashPrescriptionData('b'))
  })
})

describe('generateVerifyToken', () => {
  it('returns 32-char hex string', () => {
    const token = generateVerifyToken()
    expect(token).toMatch(/^[a-f0-9]{32}$/)
  })

  it('generates unique tokens', () => {
    expect(generateVerifyToken()).not.toBe(generateVerifyToken())
  })
})

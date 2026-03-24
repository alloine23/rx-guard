import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { PATCH } from '../[id]/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    patient: { findUnique: jest.fn() },
    consent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    institution: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/audit', () => ({
  createAuditLog: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/notifications', () => ({
  createNotificationsForRole: jest.fn().mockResolvedValue(undefined),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require('@/lib/auth')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require('@/lib/prisma')

const HOSPITAL_ID = '550e8400-e29b-41d4-a716-446655440000'
const PATIENT_ID = 'patient-1'
const USER_ID = 'user-1'
const CONSENT_ID = 'consent-1'

function mockPatientSession() {
  auth.mockResolvedValue({ user: { id: USER_ID, email: 'patient@test.com', role: 'patient' } })
  prisma.patient.findUnique.mockResolvedValue({ id: PATIENT_ID, userId: USER_ID })
}

function makeRequest(method: string, body?: unknown, url = 'http://localhost/api/patient/consents') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/patient/consents', () => {
  it('rejects duplicate consent with 409 when pending/approved exists', async () => {
    mockPatientSession()
    prisma.institution.findUnique.mockResolvedValue({ id: HOSPITAL_ID, type: 'hospital' })
    prisma.consent.findFirst.mockResolvedValue({ id: CONSENT_ID, status: 'pending' })

    const req = makeRequest('POST', { hospitalId: HOSPITAL_ID })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/active or pending consent/i)
  })

  it('rejects non-hospital institution with 404', async () => {
    mockPatientSession()
    prisma.institution.findUnique.mockResolvedValue({ id: HOSPITAL_ID, type: 'pharmacy' })
    prisma.consent.findFirst.mockResolvedValue(null)

    const req = makeRequest('POST', { hospitalId: HOSPITAL_ID })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/hospital not found/i)
  })

  it('creates consent successfully with 201', async () => {
    mockPatientSession()
    prisma.institution.findUnique.mockResolvedValue({ id: HOSPITAL_ID, type: 'hospital' })
    prisma.consent.findFirst.mockResolvedValue(null)

    const createdConsent = {
      id: CONSENT_ID,
      patientId: PATIENT_ID,
      hospitalId: HOSPITAL_ID,
      status: 'pending',
      hospital: { id: HOSPITAL_ID, name: 'Test Hospital', location: 'City' },
    }
    prisma.consent.create.mockResolvedValue(createdConsent)

    const req = makeRequest('POST', { hospitalId: HOSPITAL_ID })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe(CONSENT_ID)
    expect(body.status).toBe('pending')
  })
})

describe('PATCH /api/patient/consents/[id]', () => {
  const patchParams = { params: Promise.resolve({ id: CONSENT_ID }) }

  it('rejects revoke if consent status is not approved (400)', async () => {
    mockPatientSession()
    prisma.consent.findUnique.mockResolvedValue({
      id: CONSENT_ID,
      patientId: PATIENT_ID,
      status: 'pending',
    })

    const req = makeRequest('PATCH', { action: 'revoke' })
    const res = await PATCH(req, patchParams)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/only approved consents can be revoked/i)
  })

  it('rejects cancel if consent status is not pending (400)', async () => {
    mockPatientSession()
    prisma.consent.findUnique.mockResolvedValue({
      id: CONSENT_ID,
      patientId: PATIENT_ID,
      status: 'approved',
    })

    const req = makeRequest('PATCH', { action: 'cancel' })
    const res = await PATCH(req, patchParams)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/only pending consents can be cancelled/i)
  })

  it('rejects if consent belongs to a different patient (403)', async () => {
    mockPatientSession()
    prisma.consent.findUnique.mockResolvedValue({
      id: CONSENT_ID,
      patientId: 'other-patient',
      status: 'approved',
    })

    const req = makeRequest('PATCH', { action: 'revoke' })
    const res = await PATCH(req, patchParams)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/forbidden/i)
  })
})

describe('GET /api/patient/consents', () => {
  it('returns consents ordered by createdAt desc', async () => {
    mockPatientSession()

    const consents = [
      { id: 'c2', patientId: PATIENT_ID, status: 'approved', createdAt: new Date('2024-02-01'), hospital: { id: HOSPITAL_ID, name: 'Hospital B', location: 'City' } },
      { id: 'c1', patientId: PATIENT_ID, status: 'pending', createdAt: new Date('2024-01-01'), hospital: { id: HOSPITAL_ID, name: 'Hospital A', location: 'City' } },
    ]
    prisma.consent.findMany.mockResolvedValue(consents)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe('c2')
    expect(body[1].id).toBe('c1')
  })
})

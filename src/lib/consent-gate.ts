import { prisma } from '@/lib/prisma'

export class ConsentError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Checks if a patient has any approved, non-expired hospital consent.
 * Returns true if consent exists, false otherwise.
 */
export async function checkConsent(patientId: string): Promise<boolean> {
  const consent = await prisma.consent.findFirst({
    where: {
      patientId,
      status: 'approved',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  return !!consent
}

/**
 * Hard gate — throws ConsentError if no consent.
 */
export async function requireConsent(patientId: string): Promise<void> {
  const hasConsent = await checkConsent(patientId)
  if (!hasConsent) {
    throw new ConsentError(
      'No active consent for this patient',
      403
    )
  }
}

export async function requireConsentByRecordId(
  recordId: string
): Promise<string> {
  const record = await prisma.medicalRecord.findUnique({
    where: { id: recordId },
    select: { patientId: true },
  })

  if (!record) {
    throw new ConsentError('Record not found', 404)
  }

  await requireConsent(record.patientId)
  return record.patientId
}

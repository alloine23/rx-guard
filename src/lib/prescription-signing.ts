import crypto from 'node:crypto'

export function generateDoctorKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32).toString('hex'),
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

const SIGNING_FIELDS = ['date', 'doctor_name', 'medications', 'patient_name', 'record_type'] as const

export function canonicalizeRecordData(ocrData: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(ocrData))
}

export function canonicalizePrescriptionData(ocrData: Record<string, unknown>): string {
  const canonical: Record<string, unknown> = {}
  for (const field of SIGNING_FIELDS) {
    canonical[field] = ocrData[field] ?? null
  }
  return JSON.stringify(sortKeys(canonical))
}

function buildPrivateKey(privateKeyHex: string): crypto.KeyObject {
  const seed = Buffer.from(privateKeyHex, 'hex')
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex')
  return crypto.createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, seed]),
    format: 'der',
    type: 'pkcs8',
  })
}

function buildPublicKey(publicKeyHex: string): crypto.KeyObject {
  const raw = Buffer.from(publicKeyHex, 'hex')
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
  return crypto.createPublicKey({
    key: Buffer.concat([spkiPrefix, raw]),
    format: 'der',
    type: 'spki',
  })
}

export function signPrescription(canonicalData: string, privateKeyHex: string): string {
  const key = buildPrivateKey(privateKeyHex)
  const signature = crypto.sign(null, Buffer.from(canonicalData), key)
  return signature.toString('hex')
}

export function verifyPrescription(
  canonicalData: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  const key = buildPublicKey(publicKeyHex)
  const signature = Buffer.from(signatureHex, 'hex')
  return crypto.verify(null, Buffer.from(canonicalData), key, signature)
}

export function hashPrescriptionData(canonicalData: string): string {
  return crypto.createHash('sha256').update(canonicalData).digest('hex')
}

export function generateVerifyToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { randomBytes, createCipheriv } from 'crypto'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function encrypt(plaintext: string): string {
  const hex = process.env.ENCRYPTION_KEY!
  const key = Buffer.from(hex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

async function main() {
  const defaultHash = await hash('admin1234', 12)

  // 1. Superadmin
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@rxguard.local' },
    update: {},
    create: {
      email: 'superadmin@rxguard.local',
      passwordHash: defaultHash,
      role: 'superadmin',
    },
  })
  console.log('Seeded superadmin:', superadmin.email)

  // 2. Hospital + Admin
  const hospital = await prisma.institution.upsert({
    where: { id: 'ff676831-d987-4005-9fa6-33dda3f3abd1' },
    update: {},
    create: {
      id: 'ff676831-d987-4005-9fa6-33dda3f3abd1',
      name: 'USEP Medical Center',
      type: 'hospital',
      location: 'Obrero, Davao City',
    },
  })
  console.log('Seeded hospital:', hospital.name)

  const hospitalAdmin = await prisma.user.upsert({
    where: { email: 'admin@usep-med.local' },
    update: {},
    create: {
      email: 'admin@usep-med.local',
      passwordHash: defaultHash,
      role: 'admin',
      institutionId: hospital.id,
    },
  })
  console.log('Seeded hospital admin:', hospitalAdmin.email)

  // 3. Pharmacy + Admin
  const pharmacy = await prisma.institution.upsert({
    where: { id: '6ab2309f-91b1-4260-b982-b0974a7015de' },
    update: {},
    create: {
      id: '6ab2309f-91b1-4260-b982-b0974a7015de',
      name: 'RxGuard Pharmacy',
      type: 'pharmacy',
      location: 'Bolton, Davao City',
    },
  })
  console.log('Seeded pharmacy:', pharmacy.name)

  const pharmacyAdmin = await prisma.user.upsert({
    where: { email: 'admin@rxguard-pharm.local' },
    update: {},
    create: {
      email: 'admin@rxguard-pharm.local',
      passwordHash: defaultHash,
      role: 'admin',
      institutionId: pharmacy.id,
    },
  })
  console.log('Seeded pharmacy admin:', pharmacyAdmin.email)

  // 4. Doctor
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@usep-med.local' },
    update: {},
    create: {
      email: 'doctor@usep-med.local',
      passwordHash: defaultHash,
      role: 'doctor',
      institutionId: hospital.id,
    },
  })
  console.log('Seeded doctor:', doctor.email)

  // 5. Pharmacist
  const pharmacist = await prisma.user.upsert({
    where: { email: 'pharmacist@rxguard-pharm.local' },
    update: {},
    create: {
      email: 'pharmacist@rxguard-pharm.local',
      passwordHash: defaultHash,
      role: 'pharmacist',
      institutionId: pharmacy.id,
    },
  })
  console.log('Seeded pharmacist:', pharmacist.email)

  // 6. Patient (with encrypted PII)
  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@rxguard.local' },
    update: {},
    create: {
      email: 'patient@rxguard.local',
      passwordHash: defaultHash,
      role: 'patient',
    },
  })

  await prisma.patient.upsert({
    where: { patientCode: 'USEP-2026-00001' },
    update: {},
    create: {
      patientCode: 'USEP-2026-00001',
      userId: patientUser.id,
      registeredBy: doctor.id,
      fullName: encrypt('Juan Dela Cruz'),
      dateOfBirth: encrypt('1995-06-15'),
      phone: encrypt('+639171234567'),
      email: encrypt('patient@rxguard.local'),
    },
  })
  console.log('Seeded patient: USEP-2026-00001 (patient@rxguard.local)')

  // 7. Consent (patient grants hospital access)
  const patient = await prisma.patient.findUnique({
    where: { patientCode: 'USEP-2026-00001' },
  })
  if (patient) {
    const existingConsent = await prisma.consent.findFirst({
      where: { patientId: patient.id, hospitalId: hospital.id },
    })
    if (!existingConsent) {
      await prisma.consent.create({
        data: {
          patientId: patient.id,
          hospitalId: hospital.id,
          status: 'approved',
          approvedBy: hospitalAdmin.id,
          grantedAt: new Date(),
        },
      })
    }
    console.log('Seeded consent: patient → USEP Medical Center (approved)')
  }

  console.log('\n--- All test accounts use password: admin1234 ---')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

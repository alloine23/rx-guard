import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { encrypt, decrypt } from '@/lib/crypto'
import { registerPatientSchema } from '@/lib/validations/patient'
import { generatePatientCode, generateTempPassword } from '@/lib/patient-utils'
import { sendEmail } from '@/lib/email'
import { generateIDCardPdf } from '@/lib/pdf/patient-id-card'
import { hash } from 'bcryptjs'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patients = await prisma.patient.findMany({
    where: { registeredBy: session.user.id },
    select: {
      id: true,
      patientCode: true,
      fullName: true,
      dateOfBirth: true,
      createdAt: true,
    },
  })

  const decrypted = patients.map((p) => ({
    ...p,
    fullName: decrypt(p.fullName),
    dateOfBirth: decrypt(p.dateOfBirth),
  }))

  return NextResponse.json(decrypted)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!session.user.institutionId) {
    return NextResponse.json(
      { error: 'Doctor must belong to an institution' },
      { status: 400 }
    )
  }

  const body = await req.json()
  const parsed = registerPatientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { fullName, dateOfBirth, phone, email, photoUrl } = parsed.data

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })
  if (existingUser) {
    return NextResponse.json(
      { error: 'Email already in use' },
      { status: 409 }
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.patient.count()
    const patientCode = generatePatientCode(count + 1)

    const tempPwd = generateTempPassword()
    const pwdHash = await hash(tempPwd, 12)

    const user = await tx.user.create({
      data: {
        email,
        passwordHash: pwdHash,
        role: 'patient',
        forcePasswordChange: true,
      },
    })

    const patient = await tx.patient.create({
      data: {
        patientCode,
        userId: user.id,
        registeredBy: session.user.id,
        fullName: encrypt(fullName),
        phone: phone ? encrypt(phone) : null,
        email: encrypt(email),
        dateOfBirth: encrypt(dateOfBirth),
        photoUrl: photoUrl || null,
      },
    })

    return { patient, user, patientCode, tempPwd }
  })

  // Fire-and-forget welcome email with ID card PDF
  ;(async () => {
    let attachments: { filename: string; content: Buffer }[] = []
    try {
      const pdfBuffer = await generateIDCardPdf({
        patientCode: result.patientCode,
        fullName,
        dateOfBirth,
        phone: phone || null,
        photoUrl: photoUrl?.startsWith('http') ? photoUrl : null,
      })
      attachments = [{ filename: 'rxguard-id-card.pdf', content: pdfBuffer }]
    } catch (pdfErr) {
      console.error('[pdf-generation-error]', pdfErr)
    }

    await sendEmail({
      to: email,
      subject: 'Welcome to RxGuard — Your Patient ID Card',
      html: `
        <h1>Welcome to RxGuard</h1>
        <p>Your patient account has been created.</p>
        <p><strong>Patient Code:</strong> ${result.patientCode}</p>
        <p><strong>Temporary Password:</strong> ${result.tempPwd}</p>
        <p>Please log in and change your password immediately.</p>
        ${attachments.length > 0 ? '<p>Your digital ID card is attached as a PDF.</p>' : '<p>Your digital ID card will be available for download in your patient portal.</p>'}
      `,
      attachments,
    })
  })().catch((err) => {
    console.error('[email-error]', err)
  })

  await createAuditLog({
    userId: session.user.id,
    action: 'REGISTER_PATIENT',
    resourceType: 'Patient',
    resourceId: result.patient.id,
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })

  return NextResponse.json(
    {
      id: result.patient.id,
      patientCode: result.patientCode,
      email,
    },
    { status: 201 }
  )
}

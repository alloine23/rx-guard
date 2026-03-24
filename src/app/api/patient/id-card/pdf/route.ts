import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { generateIDCardPdf } from '@/lib/pdf/patient-id-card'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 })
  }

  // photoUrl may be a MinIO key — only pass to PDF if it's a full URL
  // (react-pdf <Image> needs an absolute URL to fetch from)
  const photoUrl = patient.photoUrl?.startsWith('http') ? patient.photoUrl : null

  try {
    const pdfBuffer = await generateIDCardPdf({
      patientCode: patient.patientCode,
      fullName: decrypt(patient.fullName),
      dateOfBirth: decrypt(patient.dateOfBirth),
      phone: patient.phone ? decrypt(patient.phone) : null,
      photoUrl,
    })

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rxguard-id-${patient.patientCode}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[ID-CARD-PDF] Generation failed:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

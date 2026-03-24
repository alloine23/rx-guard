import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer as pdfRenderToBuffer,
} from '@react-pdf/renderer'
import QRCode from 'qrcode'

interface IDCardProps {
  patientCode: string
  fullName: string
  dateOfBirth: string
  phone: string | null
  photoUrl: string | null
  qrDataUrl: string
}

function computeAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const styles = StyleSheet.create({
  page: {
    width: '85.6mm',
    height: '53.98mm',
    padding: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    fontFamily: 'Helvetica',
  },
  leftCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  rightCol: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  logoText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0d9488',
  },
  subtitle: {
    fontSize: 5,
    color: '#6b7280',
  },
  name: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  label: {
    fontSize: 5,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  value: {
    fontSize: 7,
    color: '#374151',
  },
  codeValue: {
    fontSize: 8,
    fontFamily: 'Courier-Bold',
    color: '#0d9488',
  },
  qrImage: {
    width: 55,
    height: 55,
  },
  qrLabel: {
    fontSize: 4,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'center',
  },
  photo: {
    width: 30,
    height: 30,
    borderRadius: 4,
    marginBottom: 4,
  },
})

function PatientIDCard({ patientCode, fullName, dateOfBirth, phone, qrDataUrl, photoUrl }: IDCardProps) {
  const age = computeAge(dateOfBirth)

  return (
    <Document>
      <Page size={[242.65, 153.01]} style={styles.page}>
        <View style={styles.leftCol}>
          <View>
            <View style={styles.header}>
              <Text style={styles.logoText}>RxGuard</Text>
              <Text style={styles.subtitle}>Patient ID Card</Text>
            </View>

            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            {photoUrl && <Image src={photoUrl} style={styles.photo} />}

            <Text style={styles.name}>{fullName}</Text>

            <Text style={styles.label}>Patient Code</Text>
            <Text style={styles.codeValue}>{patientCode}</Text>

            <Text style={styles.label}>Date of Birth</Text>
            <Text style={styles.value}>
              {formatDate(dateOfBirth)} ({age} yrs)
            </Text>

            {phone && (
              <>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{phone}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.rightCol}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image src={qrDataUrl} style={styles.qrImage} />
          <Text style={styles.qrLabel}>Scan to verify</Text>
        </View>
      </Page>
    </Document>
  )
}

export interface GenerateIDCardInput {
  patientCode: string
  fullName: string
  dateOfBirth: string
  phone: string | null
  photoUrl: string | null
}

export async function generateIDCardPdf(input: GenerateIDCardInput): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(input.patientCode, {
    width: 200,
    margin: 1,
    color: { dark: '#0d9488', light: '#ffffff' },
  })

  const buffer = await pdfRenderToBuffer(
    <PatientIDCard
      patientCode={input.patientCode}
      fullName={input.fullName}
      dateOfBirth={input.dateOfBirth}
      phone={input.phone}
      photoUrl={input.photoUrl}
      qrDataUrl={qrDataUrl}
    />
  )

  return buffer
}

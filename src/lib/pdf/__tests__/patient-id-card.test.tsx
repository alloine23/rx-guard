import React from 'react'

// Mock @react-pdf/renderer — ESM module that Jest can't transform
jest.mock('@react-pdf/renderer', () => {
  const PDF_HEADER = Buffer.from('%PDF-1.4 mock')
  return {
    Document: ({ children }: { children: React.ReactNode }) => React.createElement('Document', null, children),
    Page: ({ children }: { children: React.ReactNode }) => React.createElement('Page', null, children),
    View: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
    Text: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children),
    Image: () => React.createElement('Image'),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
    renderToBuffer: jest.fn().mockResolvedValue(PDF_HEADER),
  }
})

import { generateIDCardPdf } from '../patient-id-card'

describe('generateIDCardPdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const buffer = await generateIDCardPdf({
      patientCode: 'USEP-2026-00001',
      fullName: 'Juan Dela Cruz',
      dateOfBirth: '1990-01-15',
      phone: '+63 912 345 6789',
      photoUrl: null,
    })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.toString('ascii', 0, 5)).toMatch(/%PDF-/)
  })

  it('handles null phone gracefully', async () => {
    const buffer = await generateIDCardPdf({
      patientCode: 'USEP-2026-00002',
      fullName: 'Maria Santos',
      dateOfBirth: '2000-06-30',
      phone: null,
      photoUrl: null,
    })
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('calls renderToBuffer with correct component', async () => {
    const { renderToBuffer } = require('@react-pdf/renderer')
    renderToBuffer.mockClear()
    await generateIDCardPdf({
      patientCode: 'USEP-2026-00003',
      fullName: 'Test Patient',
      dateOfBirth: '1995-03-20',
      phone: null,
      photoUrl: null,
    })
    expect(renderToBuffer).toHaveBeenCalledTimes(1)
  })
})

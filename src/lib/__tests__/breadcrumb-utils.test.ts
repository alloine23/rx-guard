import {
  isDynamicSegment,
  buildBreadcrumbItems,
  capitalize,
} from '../breadcrumb-utils'

describe('isDynamicSegment', () => {
  it('matches standard UUIDs', () => {
    expect(isDynamicSegment('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('matches hex-only IDs (MongoDB ObjectId style)', () => {
    expect(isDynamicSegment('1920de9ebf632bf09c31700b')).toBe(true)
  })

  it('matches cuid-style IDs', () => {
    expect(isDynamicSegment('clh3am7x00000mj08d4y8r9kb')).toBe(true)
  })

  it('matches colon-separated compound IDs', () => {
    const compoundId =
      '1920de9ebf632bf09c31700b:075fe674e3ef97c90944b68dbb2e22b9:1ab231925837fc0c1a0442d07417'
    expect(isDynamicSegment(compoundId)).toBe(true)
  })

  it('does not match known segment labels', () => {
    expect(isDynamicSegment('patients')).toBe(false)
    expect(isDynamicSegment('dashboard')).toBe(false)
    expect(isDynamicSegment('records')).toBe(false)
  })

  it('does not match short unknown strings', () => {
    expect(isDynamicSegment('abc')).toBe(false)
    expect(isDynamicSegment('settings')).toBe(false)
  })
})

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('doctor')).toBe('Doctor')
    expect(capitalize('hello')).toBe('Hello')
  })
})

describe('buildBreadcrumbItems', () => {
  it('builds breadcrumbs for /doctor/patients', () => {
    const { roleSegment, items } = buildBreadcrumbItems('/doctor/patients', {})
    expect(roleSegment).toBe('doctor')
    expect(items).toEqual([
      { label: 'Patients', href: '/doctor/patients', isCurrent: true },
    ])
  })

  it('uses override for dynamic patient code segment', () => {
    const patientCode = 'PT-00001'
    const { items } = buildBreadcrumbItems(
      `/doctor/patients/${patientCode}`,
      { [patientCode]: 'John Doe' },
    )
    expect(items).toEqual([
      { label: 'Patients', href: '/doctor/patients', isCurrent: false },
      {
        label: 'John Doe',
        href: `/doctor/patients/${patientCode}`,
        isCurrent: true,
      },
    ])
  })

  it('truncates dynamic segment when no override is provided', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { items } = buildBreadcrumbItems(`/doctor/records/${uuid}`, {})
    expect(items).toEqual([
      { label: 'Record', href: '/doctor/records', isCurrent: false },
      {
        label: '550e8400\u2026',
        href: `/doctor/records/${uuid}`,
        isCurrent: true,
      },
    ])
  })

  it('uses override for colon-separated compound IDs', () => {
    const compoundId =
      '1920de9ebf632bf09c31700b:075fe674e3ef97c90944b68dbb2e22b9:1ab231925837fc0c1a0442d07417'
    const { items } = buildBreadcrumbItems(
      `/doctor/patients/${compoundId}`,
      { [compoundId]: 'Jane Smith' },
    )
    expect(items).toEqual([
      { label: 'Patients', href: '/doctor/patients', isCurrent: false },
      {
        label: 'Jane Smith',
        href: `/doctor/patients/${compoundId}`,
        isCurrent: true,
      },
    ])
  })

  it('shows truncated label for compound ID without override', () => {
    const compoundId =
      '1920de9ebf632bf09c31700b:075fe674e3ef97c90944b68dbb2e22b9:1ab231925837fc0c1a0442d07417'
    const { items } = buildBreadcrumbItems(
      `/doctor/patients/${compoundId}`,
      {},
    )
    expect(items).toEqual([
      { label: 'Patients', href: '/doctor/patients', isCurrent: false },
      {
        label: '1920de9e\u2026',
        href: `/doctor/patients/${compoundId}`,
        isCurrent: true,
      },
    ])
  })

  it('skips non-current dynamic segments without override', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const { items } = buildBreadcrumbItems(
      `/doctor/patients/${uuid}/extra`,
      {},
    )
    // The UUID segment is not current and has no override, so it's skipped
    expect(items).toEqual([
      { label: 'Patients', href: '/doctor/patients', isCurrent: false },
      { label: 'Extra', href: `/doctor/patients/${uuid}/extra`, isCurrent: true },
    ])
  })

  it('returns empty for root path', () => {
    const { roleSegment, items } = buildBreadcrumbItems('/', {})
    expect(roleSegment).toBe('')
    expect(items).toEqual([])
  })
})

/**
 * Pure breadcrumb-building logic, extracted for testability.
 */

export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  institutions: 'Institutions',
  doctors: 'Doctors',
  patients: 'Patients',
  consents: 'Consents',
  'audit-logs': 'Audit Logs',
  'id-card': 'ID Card',
  search: 'Search',
  records: 'Record',
  users: 'Users',
  verifications: 'Verifications',
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function isDynamicSegment(segment: string): boolean {
  // UUIDs, MongoDB ObjectIds, cuid, or colon-separated IDs
  return (
    /^[a-f0-9-]{8,}$/i.test(segment) ||
    /^c[a-z0-9]{20,}$/i.test(segment) ||
    (segment.length > 16 && !(segment in SEGMENT_LABELS))
  )
}

export interface BreadcrumbItem {
  label: string
  href: string
  isCurrent: boolean
}

// Segments that are path-only (no standalone page) — redirect to actual page
// with optional label override
const PATH_ONLY_SEGMENTS: Record<string, Record<string, { href: string; label?: string }>> = {
  pharmacist: { records: { href: '/pharmacist/search', label: 'Search' } },
}

/**
 * Build breadcrumb items from a pathname and optional overrides.
 * Returns the role segment and the list of breadcrumb items.
 */
export function buildBreadcrumbItems(
  pathname: string,
  overrides: Record<string, string>,
): { roleSegment: string; items: BreadcrumbItem[] } {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { roleSegment: '', items: [] }

  const roleSegment = segments[0]
  const pathSegments = segments.slice(1)
  const items: BreadcrumbItem[] = []

  let currentPath = `/${roleSegment}`
  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i]
    currentPath += `/${seg}`
    const isCurrent = i === pathSegments.length - 1

    if (overrides[seg]) {
      items.push({ label: overrides[seg], href: currentPath, isCurrent })
      continue
    }

    if (isDynamicSegment(seg)) {
      if (isCurrent) {
        items.push({
          label: seg.slice(0, 8) + '\u2026',
          href: currentPath,
          isCurrent: true,
        })
      }
      continue
    }

    // Redirect path-only segments to their actual page
    const redirect = PATH_ONLY_SEGMENTS[roleSegment]?.[seg]

    const label = redirect?.label ?? SEGMENT_LABELS[seg] ?? capitalize(seg)
    items.push({ label, href: redirect?.href ?? currentPath, isCurrent })
  }

  return { roleSegment, items }
}

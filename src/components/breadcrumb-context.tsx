'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export interface CustomBreadcrumb {
  label: string
  href: string
}

interface BreadcrumbOverrides {
  /** Map of dynamic segment value (e.g. UUID) → display label */
  overrides: Record<string, string>
  setOverride: (segment: string, label: string) => void
  /** Fully custom breadcrumb trail (overrides auto-generated one) */
  customBreadcrumbs: CustomBreadcrumb[] | null
  setCustomBreadcrumbs: (items: CustomBreadcrumb[] | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbOverrides>({
  overrides: {},
  setOverride: () => {},
  customBreadcrumbs: null,
  setCustomBreadcrumbs: () => {},
})

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [customBreadcrumbs, setCustomBreadcrumbsState] = useState<CustomBreadcrumb[] | null>(null)

  const setOverride = useCallback((segment: string, label: string) => {
    setOverrides((prev) => {
      if (prev[segment] === label) return prev
      return { ...prev, [segment]: label }
    })
  }, [])

  const setCustomBreadcrumbs = useCallback((items: CustomBreadcrumb[] | null) => {
    setCustomBreadcrumbsState(items)
  }, [])

  const value = useMemo(
    () => ({ overrides, setOverride, customBreadcrumbs, setCustomBreadcrumbs }),
    [overrides, setOverride, customBreadcrumbs, setCustomBreadcrumbs],
  )

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbOverride() {
  return useContext(BreadcrumbContext)
}

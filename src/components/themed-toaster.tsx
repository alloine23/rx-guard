'use client'

import { Toaster } from 'sileo'
import { useTheme } from 'next-themes'

export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Toaster
      position="top-center"
      options={{
        fill: isDark ? 'oklch(0.21 0.02 230)' : 'oklch(1 0 0)',
        roundness: 12,
        duration: 3500,
        styles: {
          title: isDark
            ? 'font-medium! tracking-[-0.01em]!'
            : 'font-medium! tracking-[-0.01em]!',
          description: isDark
            ? 'leading-relaxed!'
            : 'leading-relaxed!',
        },
      }}
    />
  )
}

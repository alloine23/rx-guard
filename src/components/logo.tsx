import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  glow?: boolean
}

export function Logo({ size = 32, className, glow }: LogoProps) {
  const linId = 'logo-lin'
  const radId = 'logo-rad'
  const maskId = 'logo-mask'

  // Shield path — classic heater shield with a crisp flat top and pointed bottom
  const shield =
    'M11 4H37C40.3 4 43 6.7 43 10V27C43 37.5 34 45 24 47C14 45 5 37.5 5 27V10C5 6.7 7.7 4 11 4Z'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="RxGuard logo"
      className={cn(
        glow && 'drop-shadow-[0_0_20px_rgba(20,184,166,0.65)]',
        className,
      )}
    >
      <defs>
        {/* Primary diagonal gradient — teal to deep emerald */}
        <linearGradient
          id={linId}
          x1="8"
          y1="3"
          x2="42"
          y2="47"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5eead4" />          {/* teal-300 */}
          <stop offset="0.42" stopColor="#0d9488" />  {/* teal-600 */}
          <stop offset="1" stopColor="#064e3b" />  {/* emerald-950 */}
        </linearGradient>

        {/* Radial gloss highlight — upper-left bright spot */}
        <radialGradient
          id={radId}
          cx="35%"
          cy="18%"
          r="58%"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="white" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="white" stopOpacity="0.06" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Clip mask so radial gloss stays inside the shield */}
        <clipPath id={maskId}>
          <path d={shield} />
        </clipPath>
      </defs>

      {/* ── Shield fill ── */}
      <path d={shield} fill={`url(#${linId})`} />

      {/* ── Gloss overlay (clipped to shield) ── */}
      <rect
        x="0" y="0" width="48" height="48"
        fill={`url(#${radId})`}
        clipPath={`url(#${maskId})`}
      />

      {/* ── Inner border — adds perceived depth ── */}
      <path
        d="M13 6.5H35C37.5 6.5 39.5 8.5 39.5 11V26.5C39.5 35 32.5 42 24 44C15.5 42 8.5 35 8.5 26.5V11C8.5 8.5 10.5 6.5 13 6.5Z"
        stroke="white"
        strokeOpacity="0.14"
        strokeWidth="1"
        fill="none"
      />

      {/* ── Top-edge gloss arc — rim shine ── */}
      <path
        d="M13 6.5 Q24 4.5 35 6.5"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* ══════════════════════════
          Rx glyph
          ══════════════════════════ */}

      {/* R — vertical stem */}
      <path
        d="M15 11V33"
        stroke="white"
        strokeWidth="4.2"
        strokeLinecap="round"
      />

      {/* R — compact bowl */}
      <path
        d="M15 11H21.5C26 11 28.5 14 28.5 17.8C28.5 21.6 26 24 21.5 24H15"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* R leg → x main diagonal (one continuous stroke) */}
      <path
        d="M20.5 24L34 38"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* x counter stroke — crosses the leg */}
      <path
        d="M32 26L22 38"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Logo size={32} />
      <span className="text-sm font-semibold tracking-tight">RxGuard</span>
    </div>
  )
}

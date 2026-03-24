'use client'

import { Badge } from '@/components/ui/badge'
import {
  humanizeKey,
  isArrayOfObjects,
  isArrayOfPrimitives,
} from '@/lib/dynamic-record-utils'

function RenderValue({
  label,
  value,
  depth = 0,
}: {
  label: string
  value: unknown
  depth?: number
}) {
  // Null / undefined / empty string
  if (value === null || value === undefined || value === '') {
    return (
      <div className="space-y-0.5">
        <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {humanizeKey(label)}
        </dt>
        <dd className="text-sm font-medium text-muted-foreground/60">N/A</dd>
      </div>
    )
  }

  // Boolean
  if (typeof value === 'boolean') {
    return (
      <div className="space-y-0.5">
        <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {humanizeKey(label)}
        </dt>
        <dd>
          <Badge
            variant={value ? 'default' : 'secondary'}
            className={
              value
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            }
          >
            {value ? 'Yes' : 'No'}
          </Badge>
        </dd>
      </div>
    )
  }

  // String or Number
  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <div className="space-y-0.5">
        <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {humanizeKey(label)}
        </dt>
        <dd className="text-sm font-medium">{String(value)}</dd>
      </div>
    )
  }

  // Array of primitives
  if (isArrayOfPrimitives(value)) {
    return (
      <div className="space-y-0.5">
        <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {humanizeKey(label)}
        </dt>
        <dd className="text-sm font-medium">
          {value.length === 0 ? (
            <span className="text-muted-foreground/60">N/A</span>
          ) : value.length <= 5 ? (
            value.map(String).join(', ')
          ) : (
            <ul className="list-inside list-disc space-y-0.5">
              {value.map((item, i) => (
                <li key={i}>{String(item)}</li>
              ))}
            </ul>
          )}
        </dd>
      </div>
    )
  }

  // Array of objects → table
  if (isArrayOfObjects(value)) {
    const columns = Array.from(
      new Set(value.flatMap((row) => Object.keys(row)))
    ).filter((k) => !k.startsWith('_'))

    return (
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {humanizeKey(label)}
        </h4>
        <div className="overflow-hidden rounded-lg border border-border/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {humanizeKey(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-border/20 last:border-b-0"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2">
                      <CellValue value={row[col]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Nested object → card/section with recursion
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([k]) => !k.startsWith('_')
    )

    if (entries.length === 0) return null

    return (
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {humanizeKey(label)}
        </h4>
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <RenderValue key={k} label={k} value={v} depth={depth + 1} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {humanizeKey(label)}
      </dt>
      <dd className="text-sm font-medium text-muted-foreground/60">
        {JSON.stringify(value)}
      </dd>
    </div>
  )
}

/** Renders a value inside a table cell — keeps it compact */
function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground/60">N/A</span>
  }

  if (typeof value === 'boolean') {
    return (
      <Badge
        variant={value ? 'default' : 'secondary'}
        className={
          value
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        }
      >
        {value ? 'Yes' : 'No'}
      </Badge>
    )
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return <span className="text-sm font-medium">{String(value)}</span>
  }

  if (isArrayOfPrimitives(value)) {
    return (
      <span className="text-sm font-medium">
        {value.length === 0 ? 'N/A' : value.map(String).join(', ')}
      </span>
    )
  }

  // Complex nested value in a table cell — stringify
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([k]) => !k.startsWith('_')
    )
    // If it's a simple flat object with few keys, render inline
    if (
      !Array.isArray(value) &&
      entries.length <= 3 &&
      entries.every(([, v]) => typeof v !== 'object' || v === null)
    ) {
      return (
        <span className="text-sm font-medium">
          {entries.map(([k, v]) => `${humanizeKey(k)}: ${v ?? 'N/A'}`).join(', ')}
        </span>
      )
    }
    return (
      <pre className="max-w-[200px] truncate text-xs text-muted-foreground">
        {JSON.stringify(value, null, 1)}
      </pre>
    )
  }

  return <span className="text-sm font-medium">{String(value)}</span>
}

function isScalar(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const t = typeof value
  return t === 'string' || t === 'number' || t === 'boolean'
}

export function DynamicRecordView({
  data,
}: {
  data: Record<string, unknown>
}) {
  const recordType = data.record_type as string | undefined

  const entries = Object.entries(data).filter(
    ([key]) => key !== 'record_type' && !key.startsWith('_')
  )

  // Separate scalar fields (compact grid) from complex fields (full-width)
  const scalarEntries = entries.filter(([, v]) => isScalar(v))
  const complexEntries = entries.filter(([, v]) => !isScalar(v))

  return (
    <div className="space-y-5">
      {recordType && (
        <Badge variant="outline" className="text-xs capitalize">
          {recordType.replace(/_/g, ' ')}
        </Badge>
      )}

      {/* Scalar fields in a compact grid */}
      {scalarEntries.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {scalarEntries.map(([key, value]) => (
            <RenderValue key={key} label={key} value={value} depth={0} />
          ))}
        </dl>
      )}

      {/* Complex fields — full width, each gets breathing room */}
      {complexEntries.length > 0 && scalarEntries.length > 0 && (
        <div className="border-t border-border/30" />
      )}
      {complexEntries.length > 0 && (
        <div className="space-y-5">
          {complexEntries.map(([key, value]) => (
            <RenderValue key={key} label={key} value={value} depth={0} />
          ))}
        </div>
      )}
    </div>
  )
}

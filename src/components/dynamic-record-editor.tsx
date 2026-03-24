'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  humanizeKey,
  isArrayOfObjects,
  isArrayOfPrimitives,
} from '@/lib/dynamic-record-utils'
import { Plus, Trash2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Path = (string | number)[]

interface EditorProps {
  data: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
}

// ---------------------------------------------------------------------------
// Deep-update helpers (immutable via structuredClone)
// ---------------------------------------------------------------------------

function deepSet(
  obj: Record<string, unknown>,
  path: Path,
  value: unknown,
): Record<string, unknown> {
  const clone = structuredClone(obj)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = clone
  for (let i = 0; i < path.length - 1; i++) {
    cursor = cursor[path[i]]
  }
  cursor[path[path.length - 1]] = value
  return clone
}

function deepDelete(
  obj: Record<string, unknown>,
  path: Path,
): Record<string, unknown> {
  const clone = structuredClone(obj)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = clone
  for (let i = 0; i < path.length - 1; i++) {
    cursor = cursor[path[i]]
  }
  const last = path[path.length - 1]
  if (Array.isArray(cursor) && typeof last === 'number') {
    cursor.splice(last, 1)
  } else {
    delete cursor[last]
  }
  return clone
}

function deepPush(
  obj: Record<string, unknown>,
  path: Path,
  value: unknown,
): Record<string, unknown> {
  const clone = structuredClone(obj)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = clone
  for (const segment of path) {
    cursor = cursor[segment]
  }
  if (Array.isArray(cursor)) {
    cursor.push(value)
  }
  return clone
}

// ---------------------------------------------------------------------------
// Build an empty row from the keys of existing rows in an object array
// ---------------------------------------------------------------------------

function emptyRowFromTemplate(
  rows: Record<string, unknown>[],
): Record<string, unknown> {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const row: Record<string, unknown> = {}
  for (const key of keys) {
    // Infer default from the first non-null value seen
    const sample = rows.find((r) => r[key] != null)?.[key]
    if (typeof sample === 'boolean') row[key] = false
    else if (typeof sample === 'number') row[key] = 0
    else row[key] = ''
  }
  return row
}

// ---------------------------------------------------------------------------
// Recursive field renderer
// ---------------------------------------------------------------------------

function FieldEditor({
  label,
  value,
  path,
  data,
  onChange,
}: {
  label: string
  value: unknown
  path: Path
  data: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
}) {
  const labelClasses =
    'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

  // ---- Boolean ----
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3">
        <label className={labelClasses}>{humanizeKey(label)}</label>
        <Switch
          checked={value}
          onCheckedChange={(checked: boolean) =>
            onChange(deepSet(data, path, checked))
          }
        />
      </div>
    )
  }

  // ---- Number ----
  if (typeof value === 'number') {
    return (
      <div className="space-y-1">
        <label className={labelClasses}>{humanizeKey(label)}</label>
        <Input
          type="number"
          value={value}
          onChange={(e) =>
            onChange(
              deepSet(
                data,
                path,
                e.target.value === '' ? 0 : Number(e.target.value),
              ),
            )
          }
        />
      </div>
    )
  }

  // ---- String (or null/undefined treated as string) ----
  if (typeof value === 'string' || value === null || value === undefined) {
    return (
      <div className="space-y-1">
        <label className={labelClasses}>{humanizeKey(label)}</label>
        <Input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(deepSet(data, path, e.target.value))}
        />
      </div>
    )
  }

  // ---- Array of objects ----
  if (isArrayOfObjects(value)) {
    const columns = Array.from(
      new Set(value.flatMap((row) => Object.keys(row))),
    ).filter((k) => !k.startsWith('_'))

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className={labelClasses}>{humanizeKey(label)}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange(deepPush(data, path, emptyRowFromTemplate(value)))
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {value.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="relative rounded-lg border border-border/40 bg-muted/10 p-3"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1.5 top-1.5 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange(deepDelete(data, [...path, rowIdx]))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              <div className="grid gap-3 pr-8 sm:grid-cols-2">
                {columns.map((col) => (
                  <FieldEditor
                    key={col}
                    label={col}
                    value={row[col]}
                    path={[...path, rowIdx, col]}
                    data={data}
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          ))}

          {value.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground/60">
              No items yet.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---- Array of primitives ----
  if (Array.isArray(value) && isArrayOfPrimitives(value)) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className={labelClasses}>{humanizeKey(label)}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(deepPush(data, path, ''))}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        <div className="space-y-1.5">
          {value.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                type={typeof item === 'number' ? 'number' : 'text'}
                value={item as string | number}
                onChange={(e) => {
                  const next =
                    typeof item === 'number'
                      ? Number(e.target.value)
                      : e.target.value
                  onChange(deepSet(data, [...path, idx], next))
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange(deepDelete(data, [...path, idx]))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {value.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground/60">
              No items yet.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---- Empty array (treat as primitive list) ----
  if (Array.isArray(value) && value.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className={labelClasses}>{humanizeKey(label)}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(deepPush(data, path, ''))}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <p className="py-2 text-center text-xs text-muted-foreground/60">
          No items yet.
        </p>
      </div>
    )
  }

  // ---- Nested object ----
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([k]) => !k.startsWith('_'),
    )

    if (entries.length === 0) return null

    return (
      <div className="space-y-1.5">
        <h4 className={labelClasses}>{humanizeKey(label)}</h4>
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <FieldEditor
                key={k}
                label={k}
                value={v}
                path={[...path, k]}
                data={data}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- Fallback (stringify) ----
  return (
    <div className="space-y-1">
      <label className={labelClasses}>{humanizeKey(label)}</label>
      <Input type="text" value={JSON.stringify(value)} readOnly />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

function isScalarValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const t = typeof value
  return t === 'string' || t === 'number' || t === 'boolean'
}

export function DynamicRecordEditor({ data, onChange }: EditorProps) {
  const recordType = data.record_type as string | undefined

  const entries = Object.entries(data).filter(
    ([key]) => key !== 'record_type' && !key.startsWith('_'),
  )

  const scalarEntries = entries.filter(([, v]) => isScalarValue(v))
  const complexEntries = entries.filter(([, v]) => !isScalarValue(v))

  return (
    <div className="space-y-5">
      {/* Record type input — always shown at top when present */}
      {recordType !== undefined && (
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Record Type
          </label>
          <Input
            type="text"
            value={recordType ?? ''}
            onChange={(e) =>
              onChange(deepSet(data, ['record_type'], e.target.value))
            }
          />
        </div>
      )}

      {/* Scalar fields in a compact grid */}
      {scalarEntries.length > 0 && (
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {scalarEntries.map(([key, value]) => (
            <FieldEditor
              key={key}
              label={key}
              value={value}
              path={[key]}
              data={data}
              onChange={onChange}
            />
          ))}
        </div>
      )}

      {/* Complex fields — full width */}
      {complexEntries.length > 0 && scalarEntries.length > 0 && (
        <div className="border-t border-border/30" />
      )}
      {complexEntries.length > 0 && (
        <div className="space-y-5">
          {complexEntries.map(([key, value]) => (
            <FieldEditor
              key={key}
              label={key}
              value={value}
              path={[key]}
              data={data}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

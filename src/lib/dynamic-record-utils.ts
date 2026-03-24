export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
  )
}

export function isArrayOfPrimitives(value: unknown): value is (string | number | boolean)[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item !== 'object' || item === null)
  )
}

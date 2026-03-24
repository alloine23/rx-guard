import { generateObject, generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { MedicalRecordFieldsSchema, type MedicalRecordFields } from '@/lib/validations/medical-record'

const VALID_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/

export function sanitizeLlmKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLlmKeys)
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (VALID_KEY_RE.test(key)) {
        result[key] = sanitizeLlmKeys(val)
      }
    }
    return result
  }
  return value
}

export function validateLlmDepth(value: unknown, maxDepth: number, current = 0): boolean {
  if (current > maxDepth) return false
  if (Array.isArray(value)) {
    return value.every((item) => validateLlmDepth(item, maxDepth, current))
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((v) =>
      validateLlmDepth(v, maxDepth, current + 1),
    )
  }
  return true
}

const MAX_DEPTH = 5
const MAX_JSON_SIZE = 50 * 1024 // 50KB

export async function extractWithLlm(
  imageBuffer: Buffer,
): Promise<MedicalRecordFields | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash'
  const openrouter = createOpenRouter({ apiKey })

  try {
    const base64 = imageBuffer.toString('base64')
    const mimeType = 'image/png'

    const { object } = await generateObject({
      model: openrouter(model),
      schema: MedicalRecordFieldsSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the following fields from this medical record image: patient_name, date, diagnosis, medications (each with name, dosage, frequency), and doctor_name. Return structured data only.',
            },
            {
              type: 'image',
              image: `data:${mimeType};base64,${base64}`,
            },
          ],
        },
      ],
    })

    return object
  } catch (error) {
    console.error('[ocr-llm] LLM extraction failed:', error)
    return null
  }
}

export async function extractWithLlmDirect(
  imageBuffer: Buffer,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash'
  const openrouter = createOpenRouter({ apiKey })

  try {
    const base64 = imageBuffer.toString('base64')
    const mimeType = 'image/png'

    const { text } = await generateText({
      model: openrouter(model),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a medical document analysis AI. Analyze this medical record image and extract all clinically relevant information.

Instructions:
1. First, identify the type of medical record. Set "record_type" to one of: prescription, lab_result, discharge_summary, radiology, consultation, progress_note, surgical_report, or other.
2. Extract every clinically relevant field visible in the document.
3. Use snake_case keys with descriptive names (e.g., "patient_name", "test_results", "discharge_medications").
4. Group related items into arrays of objects where appropriate (e.g., medications as [{name, dosage, frequency}], test results as [{test, value, unit, reference_range}]).
5. Always include "patient_name" and "date" if visible.
6. Return ONLY valid JSON. No markdown, no code fences, no explanation.

Example for a prescription:
{"record_type":"prescription","patient_name":"John Doe","date":"2024-01-15","diagnosis":"Hypertension","doctor_name":"Dr. Smith","medications":[{"name":"Lisinopril","dosage":"10mg","frequency":"once daily"}]}

Example for a lab result:
{"record_type":"lab_result","patient_name":"Jane Doe","date":"2024-02-20","ordering_physician":"Dr. Lee","lab_name":"City Lab","test_results":[{"test":"CBC","wbc":"5.2","rbc":"4.8","unit":"x10^9/L","reference_range":"4.5-11.0"}]}`,
            },
            {
              type: 'image',
              image: `data:${mimeType};base64,${base64}`,
            },
          ],
        },
      ],
    })

    // Parse the JSON response - strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('[ocr-llm-direct] LLM returned non-object JSON')
      return null
    }

    if (typeof parsed.record_type !== 'string' || parsed.record_type.length === 0) {
      console.error('[ocr-llm-direct] LLM response missing record_type')
      return null
    }

    // Safety: validate depth
    if (!validateLlmDepth(parsed, MAX_DEPTH)) {
      console.error('[ocr-llm-direct] LLM response exceeds max depth')
      return null
    }

    // Safety: validate size
    const serialized = JSON.stringify(parsed)
    if (serialized.length > MAX_JSON_SIZE) {
      console.error('[ocr-llm-direct] LLM response exceeds max size')
      return null
    }

    // Safety: sanitize keys
    const sanitized = sanitizeLlmKeys(parsed) as Record<string, unknown>

    // Verify record_type survived sanitization
    if (typeof sanitized.record_type !== 'string' || sanitized.record_type.length === 0) {
      console.error('[ocr-llm-direct] record_type lost during sanitization')
      return null
    }

    return sanitized
  } catch (error) {
    console.error('[ocr-llm-direct] LLM direct extraction failed:', error)
    return null
  }
}

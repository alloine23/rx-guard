jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
}))

jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => jest.fn()),
}))

import { sanitizeLlmKeys, validateLlmDepth } from '../ocr-llm'
import { generateText } from 'ai'

describe('sanitizeLlmKeys', () => {
  it('strips keys that do not match /^[a-z][a-z0-9_]{0,63}$/', () => {
    const input = {
      record_type: 'prescription',
      patient_name: 'John',
      '<script>': 'xss',
      '': 'empty',
      UPPER_CASE: 'bad',
      valid_key_2: 'good',
    }
    const result = sanitizeLlmKeys(input)
    expect(result).toEqual({
      record_type: 'prescription',
      patient_name: 'John',
      valid_key_2: 'good',
    })
  })

  it('recursively sanitizes nested objects', () => {
    const input = {
      record_type: 'lab',
      nested: { good_key: 'ok', 'BAD': 'no' },
    }
    const result = sanitizeLlmKeys(input)
    expect(result).toEqual({
      record_type: 'lab',
      nested: { good_key: 'ok' },
    })
  })

  it('recursively sanitizes arrays of objects', () => {
    const input = {
      record_type: 'lab',
      tests: [{ test_name: 'CBC', 'BAD KEY': 'x' }],
    }
    const result = sanitizeLlmKeys(input)
    expect(result).toEqual({
      record_type: 'lab',
      tests: [{ test_name: 'CBC' }],
    })
  })
})

describe('validateLlmDepth', () => {
  it('returns true for depth <= 5', () => {
    const data = { a: { b: { c: { d: { e: 'leaf' } } } } }
    expect(validateLlmDepth(data, 5)).toBe(true)
  })

  it('returns false for depth > 5', () => {
    const data = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }
    expect(validateLlmDepth(data, 5)).toBe(false)
  })

  it('handles arrays correctly', () => {
    const data = { a: [{ b: { c: { d: { e: 'ok' } } } }] }
    expect(validateLlmDepth(data, 5)).toBe(true)
  })
})

describe('extractWithLlmDirect', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY
  })

  it('returns parsed and sanitized JSON from LLM response', async () => {
    const { extractWithLlmDirect } = require('../ocr-llm')
    ;(generateText as jest.Mock).mockResolvedValue({
      text: JSON.stringify({
        record_type: 'prescription',
        patient_name: 'John Doe',
        medications: [{ name: 'Aspirin', dosage: '100mg', frequency: 'daily' }],
      }),
    })

    const result = await extractWithLlmDirect(Buffer.from('fake-image'))
    expect(result).toEqual({
      record_type: 'prescription',
      patient_name: 'John Doe',
      medications: [{ name: 'Aspirin', dosage: '100mg', frequency: 'daily' }],
    })
  })

  it('strips markdown code fences from response', async () => {
    const { extractWithLlmDirect } = require('../ocr-llm')
    ;(generateText as jest.Mock).mockResolvedValue({
      text: '```json\n{"record_type":"lab_result","patient_name":"Jane"}\n```',
    })

    const result = await extractWithLlmDirect(Buffer.from('fake-image'))
    expect(result?.record_type).toBe('lab_result')
  })

  it('returns null when record_type is missing', async () => {
    const { extractWithLlmDirect } = require('../ocr-llm')
    ;(generateText as jest.Mock).mockResolvedValue({
      text: JSON.stringify({ patient_name: 'No Type' }),
    })

    const result = await extractWithLlmDirect(Buffer.from('fake-image'))
    expect(result).toBeNull()
  })

  it('returns null when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY
    const { extractWithLlmDirect } = require('../ocr-llm')
    const result = await extractWithLlmDirect(Buffer.from('fake-image'))
    expect(result).toBeNull()
  })
})

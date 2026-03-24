import { Worker, type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { getRecordBuffer } from '@/lib/minio'
import { getRedisConnection } from '@/lib/queue'
import { extractWithLlm } from '@/lib/ocr-llm'
import { logger } from '@/lib/logger'

interface OcrJobData {
  recordId: string
  minioKey: string
  mode?: 'llm_direct'
}

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? 'http://localhost:8000'
const OCR_ENGINE = process.env.OCR_ENGINE ?? 'hybrid'
const CONFIDENCE_THRESHOLD = parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD ?? '0.80')

async function processOcrJob(job: Job<OcrJobData>) {
  const { recordId, minioKey } = job.data

  // 1. Mark processing
  await prisma.medicalRecord.update({
    where: { id: recordId },
    data: { ocrStatus: 'processing' },
  })

  // 2. Download image from MinIO
  const imageBuffer = await getRecordBuffer(minioKey)

  // LLM direct mode — skip traditional OCR entirely
  if (job.data.mode === 'llm_direct') {
    const { extractWithLlmDirect } = await import('@/lib/ocr-llm')
    const llmResult = await extractWithLlmDirect(imageBuffer)

    if (!llmResult) {
      throw new Error('LLM direct extraction returned no result')
    }

    await prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        ocrData: llmResult as any,
        ocrConfidence: null,
        ocrEngine: 'llm_direct',
        ocrStatus: 'done',
        recordType: llmResult.record_type as string,
      },
    })
    return
  }

  // 3. Call FastAPI OCR service
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'image.png')

  const response = await fetch(`${OCR_SERVICE_URL}/ocr/process`, {
    method: 'POST',
    body: formData,
  })

  if (response.status === 400 || response.status === 422) {
    // Permanent failure — do not retry
    const detail = await response.json().catch(() => ({ detail: 'Unknown error' }))
    logger.error({ recordId, detail: detail.detail }, 'Permanent OCR failure for record')
    await prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        ocrStatus: 'failed',
        ocrData: { error: detail.detail ?? 'Invalid image' },
        ocrEngine: 'traditional',
      },
    })
    return
  }

  if (!response.ok) {
    throw new Error(`OCR service returned ${response.status}`)
  }

  const ocrResult = await response.json()
  let { fields, confidence, engine } = ocrResult

  // 4. LLM fallback if hybrid mode and low confidence
  if (confidence < CONFIDENCE_THRESHOLD && OCR_ENGINE === 'hybrid') {
    const llmResult = await extractWithLlm(imageBuffer)
    if (llmResult) {
      fields = llmResult
      engine = 'llm'
      confidence = 1.0
    } else {
      // LLM fallback failed — save traditional OCR with low confidence
      // Doctor will see low confidence and know to review manually
      await prisma.medicalRecord.update({
        where: { id: recordId },
        data: {
          ocrStatus: 'done',
          ocrEngine: 'traditional',
          ocrData: fields as any,
          ocrConfidence: confidence,
        },
      })
      logger.warn({ recordId, confidence }, 'LLM fallback failed, using traditional OCR')
      return
    }
  }

  // 5. Update record
  await prisma.medicalRecord.update({
    where: { id: recordId },
    data: {
      ocrData: fields,
      ocrConfidence: confidence,
      ocrEngine: engine,
      ocrStatus: 'done',
    },
  })
}

export function startOcrWorker() {
  const worker = new Worker<OcrJobData>('ocr-processing', processOcrJob, {
    connection: getRedisConnection() as never,
    concurrency: 2,
    lockDuration: 120000, // 2 minutes max per job
  })

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, recordId: job?.data?.recordId, err: err.message }, 'OCR job failed')

    // On final failure (exhausted retries), mark record as failed
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      try {
        await prisma.medicalRecord.update({
          where: { id: job.data.recordId },
          data: {
            ocrStatus: 'failed',
            ocrData: { error: err.message },
          },
        })
      } catch (updateErr) {
        logger.error({ recordId: job.data.recordId, updateErr }, 'Failed to update record status after job failure')
      }
    }
  })

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, recordId: job.data.recordId }, 'OCR job completed')
  })

  logger.info('OCR worker started')
  return worker
}

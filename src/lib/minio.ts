import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.MINIO_BUCKET_RECORDS ?? 'medical-records'

const globalForS3 = globalThis as unknown as { s3: S3Client | undefined }

function getS3Client(): S3Client {
  if (!globalForS3.s3) {
    globalForS3.s3 = new S3Client({
      endpoint: `http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9000'}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
      },
      forcePathStyle: true,
    })
  }
  return globalForS3.s3
}

let bucketChecked = false

async function ensureBucket() {
  if (bucketChecked) return
  const s3 = getS3Client()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
  }
  bucketChecked = true
}

export async function uploadRecord(
  patientId: string,
  recordId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await ensureBucket()
  const key = `${patientId}/${recordId}.png`
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  return key
}

export async function getRecordUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(getS3Client(), command, { expiresIn: 900 })
}

export async function getRecordBuffer(key: string): Promise<Buffer> {
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  )
  if (!response.Body) {
    throw new Error(`MinIO returned empty body for key: ${key}`)
  }
  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}

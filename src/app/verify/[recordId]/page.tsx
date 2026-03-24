import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VerifyResult {
  signed: boolean
  valid?: boolean
  tampered?: boolean
  signedAt?: string
  algorithm?: string
  error?: string
}

async function fetchVerification(recordId: string, token: string | null): Promise<VerifyResult> {
  const baseUrl = process.env.AUTH_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/verify/${recordId}${token ? `?token=${token}` : ''}`
  const res = await fetch(url, { cache: 'no-store' })
  if (res.status === 404) return { signed: false, error: 'Record not found' }
  if (res.status === 429) return { signed: false, error: 'Too many requests. Please try again later.' }
  if (!res.ok) return { signed: false, error: 'Verification failed' }
  return res.json()
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ recordId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { recordId } = await params
  const { token } = await searchParams
  const result = await fetchVerification(recordId, token ?? null)

  if (result.error) {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <ShieldX className="mx-auto size-16 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold text-muted-foreground">
            {result.error}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!result.signed) {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <ShieldX className="mx-auto size-16 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-semibold text-muted-foreground">
            Not Digitally Signed
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This medical record has not been digitally signed by a doctor.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (result.valid && !result.tampered) {
    return (
      <Card className="border-green-200 dark:border-green-900 text-center">
        <CardContent className="py-12">
          <ShieldCheck className="mx-auto size-16 text-green-600 dark:text-green-400" />
          <h2 className="mt-4 text-xl font-bold text-green-700 dark:text-green-300">
            Prescription Verified
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This prescription has been digitally signed and its data is intact.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              {result.algorithm}
            </Badge>
            {result.signedAt && (
              <p className="text-xs text-muted-foreground">
                Signed on {new Date(result.signedAt).toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-red-200 dark:border-red-900 text-center">
      <CardContent className="py-12">
        <ShieldAlert className="mx-auto size-16 text-red-600 dark:text-red-400" />
        <h2 className="mt-4 text-xl font-bold text-red-700 dark:text-red-300">
          Integrity Check Failed
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This prescription data has been modified after the doctor signed it.
        </p>
        {result.signedAt && (
          <p className="mt-4 text-xs text-muted-foreground">
            Originally signed on {new Date(result.signedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

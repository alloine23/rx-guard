'use client'

import { motion, AnimatePresence } from 'motion/react'
import { Check, Loader2, AlertTriangle, Upload, Shield, Cpu, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type UploadStage =
  | 'idle'
  | 'preparing'
  | 'checking'
  | 'duplicate_found'
  | 'uploading'
  | 'done'
  | 'error'

interface StepDef {
  id: string
  label: string
  icon: React.ReactNode
}

const STEPS: StepDef[] = [
  { id: 'preparing', label: 'Preparing image', icon: <Cpu className="size-3.5" /> },
  { id: 'checking', label: 'Checking for similar records', icon: <Shield className="size-3.5" /> },
  { id: 'uploading', label: 'Uploading & processing', icon: <Upload className="size-3.5" /> },
]

function getStepIndex(stage: UploadStage): number {
  if (stage === 'preparing') return 0
  if (stage === 'checking' || stage === 'duplicate_found') return 1
  if (stage === 'uploading') return 2
  if (stage === 'done') return 3
  return -1
}

function StepIndicator({
  status,
  icon,
}: {
  status: 'complete' | 'active' | 'upcoming'
  icon: React.ReactNode
}) {
  return (
    <div className="relative flex size-8 items-center justify-center">
      <AnimatePresence mode="wait">
        {status === 'complete' && (
          <motion.div
            key="complete"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <Check className="size-4" strokeWidth={3} />
          </motion.div>
        )}
        {status === 'active' && (
          <motion.div
            key="active"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex size-8 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary"
          >
            <Loader2 className="size-4 animate-spin" />
          </motion.div>
        )}
        {status === 'upcoming' && (
          <motion.div
            key="upcoming"
            className="flex size-8 items-center justify-center rounded-full border-2 border-border/50 bg-muted/30 text-muted-foreground/50"
          >
            {icon}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface DuplicateInfo {
  similarity: number
  method: string
}

interface UploadProgressProps {
  stage: UploadStage
  error?: string
  duplicateInfo?: DuplicateInfo | null
  onConfirmDuplicate: () => void
  onCancelDuplicate: () => void
  onRetry: () => void
}

export function UploadProgress({
  stage,
  error,
  duplicateInfo,
  onConfirmDuplicate,
  onCancelDuplicate,
  onRetry,
}: UploadProgressProps) {
  const activeIndex = getStepIndex(stage)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 py-2"
    >
      {/* Steps */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const status: 'complete' | 'active' | 'upcoming' =
            i < activeIndex ? 'complete'
              : i === activeIndex ? 'active'
                : 'upcoming'

          return (
            <div key={step.id}>
              <div className="flex items-center gap-3 py-1.5">
                <StepIndicator status={status} icon={step.icon} />
                <motion.span
                  animate={{
                    opacity: status === 'upcoming' ? 0.4 : 1,
                    x: status === 'active' ? 2 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                  className={`text-sm font-medium ${
                    status === 'complete' ? 'text-emerald-600 dark:text-emerald-400'
                      : status === 'active' ? 'text-foreground'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                  {status === 'active' && (
                    <motion.span
                      animate={{ opacity: [1, 0.3] }}
                      transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.8 }}
                    >
                      ...
                    </motion.span>
                  )}
                </motion.span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="ml-[15px] h-4 w-px">
                  <motion.div
                    className="h-full w-full"
                    animate={{
                      backgroundColor: i < activeIndex
                        ? 'rgb(16 185 129)'  // emerald-500
                        : 'rgb(229 231 235)', // gray-200
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Done state */}
      <AnimatePresence>
        {stage === 'done' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30"
          >
            <Check className="size-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Record uploaded successfully
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate found state */}
      <AnimatePresence>
        {stage === 'duplicate_found' && duplicateInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Similar record found
                </h4>
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  This image is <span className="font-semibold">{duplicateInfo.similarity}%</span> similar
                  to an existing record. It may be a duplicate.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pl-12">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelDuplicate}
                className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                Cancel Upload
              </Button>
              <Button
                size="sm"
                onClick={onConfirmDuplicate}
                className="flex-1 gap-1.5 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                <Upload className="size-3.5" />
                Upload Anyway
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {stage === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
          >
            <div className="flex items-start gap-3">
              <CircleDot className="size-4 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-destructive">Upload failed</h4>
                <p className="text-xs text-destructive/80">{error || 'An unexpected error occurred.'}</p>
              </div>
            </div>
            <div className="pl-7">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

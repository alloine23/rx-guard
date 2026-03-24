import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer }[]
}

export async function sendEmail(options: SendEmailOptions) {
  if (!process.env.SMTP_USER) {
    logger.info({ to: options.to, subject: options.subject }, 'Email skipped — SMTP not configured')
    return
  }

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@rxguard.local',
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  })
}

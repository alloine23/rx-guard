# RxGuard

Computer Vision-Based Electronic Health Record (EHR) System for Medical Record Digitization.

Built for **University of Southeastern Philippines (USEP)** as a capstone project.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js App Router (API Routes), NextAuth v5 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Prisma 7 |
| Object Storage | MinIO (S3-compatible) |
| Queue | BullMQ + Redis |
| OCR Service | Python (FastAPI), EasyOCR, LLM fallback via OpenRouter |
| PDF Generation | @react-pdf/renderer |
| Containerization | Docker Compose, Nginx reverse proxy |

## Features

- **Role-Based Access Control** — Superadmin, Admin, Doctor, Pharmacist, Patient
- **Medical Record OCR** — Upload images, extract structured data via EasyOCR + LLM hybrid pipeline
- **Image Deduplication** — pHash + semantic similarity to prevent duplicate uploads
- **Digital Prescription Signing** — Doctors can digitally sign prescriptions
- **Patient Consent Management** — Hospital-centric consent flow with approval/rejection/revocation
- **Pharmacist Verification** — Pharmacists verify prescriptions before dispensing
- **Patient ID Card** — PDF generation with QR code
- **Audit Logging** — Track all sensitive operations
- **AES-256-GCM Encryption** — Sensitive patient data encrypted at rest
- **Email Notifications** — Password reset, account invitations via Nodemailer

## Prerequisites

- **Node.js** >= 18
- **Docker** & **Docker Compose**
- **Python** >= 3.10 (only if running OCR service outside Docker)

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url> rx-guard
cd rx-guard
```

### 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Random 32+ character secret (`openssl rand -base64 32`)
- `ENCRYPTION_KEY` — 32 random bytes as hex (`openssl rand -hex 32`)
- `OPENROUTER_API_KEY` — Required for LLM-based OCR (get one at [openrouter.ai](https://openrouter.ai))
- SMTP credentials for email functionality

### 3. Start infrastructure with Docker Compose

**Development (with hot reload):**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This starts PostgreSQL, Redis, MinIO, OCR service, pgAdmin, and the Next.js dev server.

**Production:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4. Local development (without Docker for Next.js)

If you prefer running Next.js locally while keeping infrastructure in Docker:

```bash
# Start only infrastructure services
docker compose up postgres redis minio -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed the database
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 5. Seed accounts

After seeding, the following test accounts are available (password: `admin1234`):

| Role | Email |
|------|-------|
| Superadmin | `superadmin@rxguard.local` |
| Admin | `admin@rxguard.local` |
| Doctor | `doctor@rxguard.local` |
| Pharmacist | `pharmacist@rxguard-pharm.local` |
| Patient | `patient@rxguard.local` |

## Services & Ports

| Service | URL |
|---------|-----|
| Next.js App | [http://localhost:3000](http://localhost:3000) |
| OCR Service | [http://localhost:8000](http://localhost:8000) |
| MinIO Console | [http://localhost:9001](http://localhost:9001) |
| pgAdmin | [http://localhost:5050](http://localhost:5050) |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

## Project Structure

```
rx-guard/
├── src/
│   ├── app/                  # Next.js App Router (pages + API routes)
│   │   ├── admin/            # Hospital admin dashboard
│   │   ├── doctor/           # Doctor dashboard
│   │   ├── patient/          # Patient dashboard
│   │   ├── pharmacist/       # Pharmacist dashboard
│   │   ├── superadmin/       # Superadmin dashboard
│   │   ├── verify/           # Public prescription verification
│   │   └── api/              # API route handlers
│   ├── components/           # React components (shadcn/ui + custom)
│   └── lib/                  # Shared utilities, auth, crypto, validations
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # SQL migrations
│   └── seed.ts               # Database seeder
├── ocr_service/              # Python FastAPI OCR microservice
├── nginx/                    # Nginx reverse proxy config
├── docs/                     # PRD, architecture docs
└── docker-compose.yml        # Docker orchestration
```

## Scripts

```bash
npm run dev       # Start Next.js dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Testing

```bash
# Run all tests
npx jest

# Run with coverage
npx jest --coverage

# OCR service tests (Python)
cd ocr_service
pip install -r requirements.txt
pytest
```

## License

This project is developed as an academic capstone for USEP. All rights reserved.

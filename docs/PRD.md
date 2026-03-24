# RxGuard — Product Requirements Document

> **Project:** RxGuard: Computer Vision-Based EHR System for Medical Record Digitization
> **Institution:** University of Southeastern Philippines (USEP)
> **Authors:** Casey Burgos, Angel Ladringan, Ashley Redulla
> **Adviser:** Leah O. Pelias
> **Target Completion:** December 2025
> **Compliance:** RA 10173 (Data Privacy Act of 2012)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [User Roles & Personas](#4-user-roles--personas)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Core Features](#7-core-features)
8. [Database Schema](#8-database-schema)
9. [API Specification](#9-api-specification)
10. [OCR Pipeline Design](#10-ocr-pipeline-design)
11. [Image Deduplication Design](#11-image-deduplication-design)
12. [RBAC & Consent System](#12-rbac--consent-system)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Success Criteria & Evaluation Metrics](#14-success-criteria--evaluation-metrics)
15. [Security & Privacy](#15-security--privacy)
16. [Constraints & Risks](#16-constraints--risks)

---

## 1. Executive Summary

RxGuard is a web-based Electronic Health Record (EHR) system that digitizes physical medical records using computer vision and OCR. It enforces consent-based pharmacist access, prevents duplicate record uploads through perceptual and semantic image hashing, and auto-generates patient digital ID cards.

The system serves five user roles — Superadmin, Admin, Doctor, Pharmacist, and Patient — each with scoped permissions enforced via RBAC. All sensitive data access is audit-logged in compliance with RA 10173 (Data Privacy Act of 2012).

---

## 2. Problem Statement

Philippine healthcare institutions rely heavily on paper-based medical records, creating three critical problems:

1. **Inaccessibility** — records are tied to a physical location, unavailable during transfers, emergencies, or multi-institution visits.
2. **Duplication** — the same physical record is re-uploaded or re-photographed multiple times, creating inconsistent patient histories.
3. **Unauthorized access** — pharmacists and third parties can access prescription data without patient consent, violating privacy rights.

The 2023 PhilHealth ransomware breach exposed 13M patient records, highlighting the urgency of secure, digitized health infrastructure in the Philippines.

---

## 3. Objectives

1. Develop an OCR pipeline that digitizes physical medical records (prescriptions, lab results) into structured, searchable EHR data.
2. Implement a two-stage image deduplication system (perceptual hashing + semantic embedding similarity) achieving ≥ 85% duplicate detection accuracy.
3. Enforce a consent-based RBAC system where pharmacist access to patient records is gated by verified patient consent and admin approval.
4. Auto-generate a printable patient digital ID card (name, patient code, DOB, phone, photo) and deliver it via email upon registration.

---

## 4. User Roles & Personas

| Role | Scope | Key Actions |
|---|---|---|
| **Superadmin** | System-wide | Register hospitals/pharmacies; assign institution admins; view system-wide stats |
| **Admin** | Per institution | Register doctors; approve/reject patient consent forms; view audit logs; view dashboard stats |
| **Doctor** | Per hospital | Register patients; upload medical record images; view/manage patient EHR |
| **Pharmacist** | Per pharmacy (shared account) | Search patient by ID; view records (consent-gated); verify & dispense prescriptions |
| **Patient** | Self | Grant/revoke consent to pharmacies; view own records; download digital ID card |

---

## 5. System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS (Docker Compose)                      │
│                                                             │
│  ┌──────────┐     ┌─────────────────────┐                  │
│  │  Nginx   │────▶│  Next.js :3000      │                  │
│  │  :443    │     │  App Router + API   │                  │
│  │  (SSL)   │     │  NextAuth.js v5     │──▶ PostgreSQL    │
│  └──────────┘     │  Prisma ORM         │    :5432         │
│                   │  BullMQ (job queue) │──▶ Redis :6379   │
│                   │  OpenRouter SDK     │──▶ MinIO :9000   │
│                   └────────┬────────────┘                  │
│                            │ HTTP (internal)               │
│                   ┌────────▼────────────┐                  │
│                   │  Python FastAPI     │                  │
│                   │  :8000              │                  │
│                   │  OpenCV + EasyOCR   │                  │
│                   │  imagehash + timm   │                  │
│                   └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Technology | Responsibility |
|---|---|---|
| **Nginx** | Nginx + Let's Encrypt | Reverse proxy, SSL termination, route `/api/ocr/*` → FastAPI |
| **Next.js** | Next.js 15, Node.js | All UI, main API routes, auth, RBAC, DB access, LLM OCR path |
| **Python FastAPI** | FastAPI, Uvicorn | Traditional OCR pipeline, deduplication — internal only |
| **PostgreSQL** | PostgreSQL 16 + pgvector | Primary database, vector embeddings for dedup |
| **Redis** | Redis 7 | BullMQ job queue for async OCR, session cache, rate limiting |
| **MinIO** | MinIO | S3-compatible object storage for images, PDFs |

### OCR Strategy (Hybrid — Configurable)

Controlled by `OCR_ENGINE=traditional|llm|hybrid` in `.env`:

```
Upload → Traditional OCR (Python FastAPI)
            │
            ▼ confidence score
       >= threshold? ──YES──▶ use result ✅
            │
            NO
            ▼
       LLM Vision (Next.js → OpenRouter)
       generateObject() + Zod schema
            │
            ▼
       Structured ocr_data JSONB → PostgreSQL
```

Both paths produce the same `ocr_data` JSONB shape. The engine used is logged per record.

---

## 6. Tech Stack

### Frontend + Main API (Next.js — Node.js)

| Package | Version | Purpose |
|---|---|---|
| `next` | 15 | App Router, Server Actions, API Routes |
| `react` | 19 | UI framework |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | v4 | Utility-first styling |
| `shadcn/ui` | latest | Accessible component library |
| `lucide-react` | latest | Icon set |
| `next-auth` | v5 | Auth with App Router adapter, RBAC sessions |
| `prisma` | 5.x | Type-safe ORM |
| `@prisma/client` | 5.x | Prisma client |
| `react-hook-form` | 7.x | Form management |
| `zod` | 3.x | Schema validation (forms + LLM output schemas) |
| `@tanstack/react-query` | v5 | Server state, OCR job polling |
| `bullmq` | 5.x | Redis-backed async job queue |
| `ioredis` | 5.x | Redis client |
| `@aws-sdk/client-s3` | v3 | MinIO/S3 file storage |
| `nodemailer` | 6.x | Email delivery (patient ID card) |
| `@react-pdf/renderer` | 3.x | Patient ID card PDF generation (server-side) |
| `sharp` | 0.33.x | Image resize/optimize before OCR |
| `@openrouter/ai-sdk-provider` | latest | OpenRouter provider for Vercel AI SDK |
| `ai` (Vercel AI SDK) | 4.x | `generateObject` for LLM-based OCR |

### OCR Microservice (Python FastAPI)

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.115.x | API framework |
| `uvicorn` | 0.30.x | ASGI server |
| `python-multipart` | 0.0.x | File upload support |
| `opencv-python` | 4.x | Image preprocessing (deskew, threshold, denoise) |
| `Pillow` | 10.x | Image I/O |
| `numpy` | 1.x | Array operations |
| `easyocr` | 1.7.x | Primary OCR engine (printed + mixed text) |
| `pytesseract` | 0.3.x | Fallback OCR engine (WER comparison) |
| `imagehash` | 4.x | pHash/dHash for fast deduplication |
| `timm` | 1.x | ViT/EfficientNet embeddings for semantic dedup |
| `torch` | 2.x | Deep learning backend for timm |
| `scikit-learn` | 1.x | Cosine similarity computation |
| `rapidfuzz` | 3.x | Medical dictionary fuzzy string matching |
| `pydantic-settings` | 2.x | Config management |
| `python-dotenv` | 1.x | `.env` loading |

### Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL 16 + pgvector | Primary DB + vector similarity search |
| Cache / Queue | Redis 7 | BullMQ job queue, session cache, rate limiting |
| File Storage | MinIO | S3-compatible object storage |
| Reverse Proxy | Nginx | SSL termination, routing |
| Containerization | Docker + Docker Compose | Single-VPS deployment |
| SSL | Let's Encrypt / Certbot | HTTPS certificates |
| CI/CD | GitHub Actions | Lint → test → build → deploy pipeline |

### Dev Tools

| Tool | Purpose |
|---|---|
| `jest` + `@testing-library/react` | Frontend unit/component tests |
| `eslint` + `prettier` | JS/TS linting and formatting |
| `pytest` + `httpx` | Python API tests |
| `ruff` + `black` | Python linting and formatting |

---

## 7. Core Features

### F1 — Medical Record Digitization (OCR)
- Doctor uploads image of physical record (prescription, lab result, etc.)
- Image stored in MinIO; OCR job enqueued to Redis via BullMQ
- **Hybrid OCR**: Traditional pipeline (OpenCV → EasyOCR → rapidfuzz) first; if confidence < `OCR_CONFIDENCE_THRESHOLD` (default: 0.8), fallback to LLM Vision via OpenRouter
- Extracted fields stored as `ocr_data` JSONB in `medical_records` table
- Doctor can review and correct extracted fields in UI

### F2 — Image Deduplication
- Runs in parallel with OCR on every upload
- **Stage 1 (fast):** pHash/dHash — Hamming distance < threshold → flag as duplicate
- **Stage 2 (semantic):** ViT/EfficientNet embedding → cosine similarity via pgvector — score ≥ 0.85 → flag as duplicate
- Duplicate uploads blocked with a diff view showing the matching existing record

### F3 — Patient Registration & Digital ID Card
- Doctor registers patient (name, DOB, phone, email, photo upload)
- System auto-generates unique `patient_code` (e.g., `USEP-2025-00001`)
- Patient ID card PDF generated via `@react-pdf/renderer` (name, patient code, age, phone, photo, QR code encoding the `patient_code` string)
- PDF emailed to patient via Nodemailer
- Patient can re-download card at any time from their dashboard

### F4 — Consent-Based Pharmacist Access
- Patient submits consent request to a specific pharmacy
- Admin reviews and approves/rejects in admin dashboard
- Pharmacist can only view patient records if: (a) valid approved consent exists, (b) consent has not been revoked
- Patient can revoke consent at any time; revocation is immediate

### F5 — Role-Based Dashboards
- **Superadmin:** System stats (hospital count, pharmacy count, doctor count, patient count), institution management table, admin assignment
- **Admin:** Pending consent approvals, doctor list, audit log viewer, institution stats
- **Doctor:** Patient list, record upload, OCR result review, patient EHR timeline
- **Pharmacist:** Patient search by `patient_code`, record viewer (consent-gated), prescription verification
- **Patient:** Consent management, record viewer (own records only), ID card download

### F6 — Audit Logging
- Every sensitive action logged to `audit_logs` (LOGIN, LOGOUT, UPLOAD_RECORD, VIEW_RECORD, GRANT_CONSENT, REVOKE_CONSENT, VERIFY_PRESCRIPTION, etc.)
- Logs include user ID, action, resource type, resource ID, IP address, timestamp
- Admin can filter and export logs

---

## 8. Database Schema

### `users`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
email                 VARCHAR(255) UNIQUE NOT NULL
password_hash         TEXT NOT NULL
role                  ENUM('superadmin','admin','doctor','pharmacist','patient') NOT NULL
institution_id        UUID REFERENCES institutions(id)
is_active             BOOLEAN DEFAULT true
force_password_change BOOLEAN DEFAULT false  -- true for auto-created patient accounts
created_at            TIMESTAMPTZ DEFAULT now()
```

### `institutions`
```sql
id                        UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                      VARCHAR(255) NOT NULL
type                      ENUM('hospital','pharmacy') NOT NULL
location                  TEXT
credentials_url           TEXT
in_charge_pharmacist_id   UUID REFERENCES users(id)
created_at                TIMESTAMPTZ DEFAULT now()
```

### `patients`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
patient_code     VARCHAR(50) UNIQUE NOT NULL
user_id          UUID NOT NULL REFERENCES users(id)  -- always created; patient receives temp password via email
registered_by    UUID REFERENCES users(id) NOT NULL
full_name        VARCHAR(255) NOT NULL
date_of_birth    DATE NOT NULL
phone            VARCHAR(20)
photo_url        TEXT
email            VARCHAR(255)
created_at       TIMESTAMPTZ DEFAULT now()
```

> **Patient account creation:** When a doctor registers a patient, a `users` row with `role='patient'` is created automatically. A random 8-character temporary password is generated, hashed, and emailed to the patient alongside their digital ID card. The patient must change this password on first login.

### `medical_records`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
patient_id       UUID REFERENCES patients(id) NOT NULL
uploaded_by      UUID REFERENCES users(id) NOT NULL
institution_id   UUID REFERENCES institutions(id) NOT NULL
image_url        TEXT NOT NULL
ocr_status       ENUM('pending','processing','done','failed') DEFAULT 'pending'
ocr_engine       ENUM('traditional','llm') -- which engine was used
ocr_data         JSONB -- extracted fields
ocr_confidence   FLOAT -- confidence score (traditional path)
record_type      VARCHAR(50) -- 'prescription', 'lab_result', 'discharge_summary', etc.
created_at       TIMESTAMPTZ DEFAULT now()
```

### `consents`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
patient_id       UUID REFERENCES patients(id) NOT NULL
pharmacy_id      UUID REFERENCES institutions(id) NOT NULL
approved_by      UUID REFERENCES users(id)
status           ENUM('pending','approved','revoked') DEFAULT 'pending'
granted_at       TIMESTAMPTZ
revoked_at       TIMESTAMPTZ
created_at       TIMESTAMPTZ DEFAULT now()
```

> **Re-consent after revocation:** No UNIQUE constraint on `(patient_id, pharmacy_id)` — a patient may re-grant consent to the same pharmacy after revoking. Each grant creates a new row. Only one consent row per patient-pharmacy pair may be in `pending` or `approved` status at any time (enforced at the application layer via a pre-insert check). Pharmacist access checks query for `status = 'approved'` on the most recent consent row.

### `prescription_verifications`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
record_id        UUID REFERENCES medical_records(id) NOT NULL
pharmacist_id    UUID REFERENCES users(id) NOT NULL
status           ENUM('verified','dispensed','rejected') DEFAULT 'verified'
rejection_reason TEXT  -- populated when status = 'rejected'
verified_at      TIMESTAMPTZ DEFAULT now()
dispensed_at     TIMESTAMPTZ
```

### `image_hashes`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
record_id        UUID REFERENCES medical_records(id) NOT NULL
phash            VARCHAR(64) -- 64-bit perceptual hash hex string
embedding        VECTOR(512) -- ViT/CNN embedding (pgvector)
created_at       TIMESTAMPTZ DEFAULT now()
```

> **Insertion order:** The `medical_records` row is always created first (with `ocr_status='pending'`) before calling the dedup service. The new `record_id` is passed to `/dedup/check` so the hash can be stored with a valid FK immediately. Dedup then queries all *other* existing rows (excluding the new record's own ID) for similarity.

### `audit_logs`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES users(id) NOT NULL
action           VARCHAR(100) NOT NULL
resource_type    VARCHAR(50)
resource_id      UUID
ip_address       INET
metadata         JSONB
created_at       TIMESTAMPTZ DEFAULT now()
```

### `notifications`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES users(id) NOT NULL
type             VARCHAR(50) -- 'consent_request', 'consent_approved', 'ocr_done', etc.
payload          JSONB
is_read          BOOLEAN DEFAULT false
created_at       TIMESTAMPTZ DEFAULT now()
```

---

## 9. API Specification

### Auth (all roles)

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Email + password → session cookie + role |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/session` | Current user, role, institution |

### Superadmin

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/institutions` | List all institutions |
| `POST` | `/api/admin/institutions` | Create hospital or pharmacy |
| `PATCH` | `/api/admin/institutions/:id` | Update institution |
| `DELETE` | `/api/admin/institutions/:id` | Remove institution |
| `POST` | `/api/admin/institutions/:id/assign-admin` | Assign admin user to institution |
| `GET` | `/api/admin/stats` | System-wide counts |

### Admin (per-institution)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/doctors` | List doctors in institution |
| `POST` | `/api/admin/doctors` | Register new doctor |
| `GET` | `/api/admin/consents` | List pending consent requests |
| `PATCH` | `/api/admin/consents/:id` | Approve or reject consent |
| `GET` | `/api/admin/audit-logs` | View institution audit logs |
| `GET` | `/api/admin/stats` | Institution-level stats |

### Doctor

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/doctor/patients` | List registered patients |
| `POST` | `/api/doctor/patients` | Register patient + trigger ID card email |
| `GET` | `/api/doctor/patients/:patientCode` | Get patient profile |
| `GET` | `/api/doctor/records?patientId=` | List records for a patient |
| `POST` | `/api/doctor/records` | Upload record image → enqueue OCR + dedup |
| `GET` | `/api/doctor/records/:id` | Get record + OCR result |
| `PATCH` | `/api/doctor/records/:id` | Correct OCR-extracted fields |

### Pharmacist

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/pharmacist/patients/:patientCode` | Search patient (consent-gated → 403 if no consent) |
| `GET` | `/api/pharmacist/records/:id` | View record (consent-gated; returns prescription-relevant fields only — medications, dosage, doctor name, date; excludes full diagnosis and other clinical notes) |
| `POST` | `/api/pharmacist/verifications` | Mark prescription verified |
| `PATCH` | `/api/pharmacist/verifications/:id` | Mark prescription dispensed |

### Patient

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/patient/consents` | List own consents |
| `POST` | `/api/patient/consents` | Grant consent to a pharmacy |
| `PATCH` | `/api/patient/consents/:id` | Revoke consent |
| `GET` | `/api/patient/records` | View own records |
| `GET` | `/api/patient/id-card` | Download digital ID card PDF |

### Python FastAPI (internal — not exposed publicly)

| Method | Route | Description |
|---|---|---|
| `POST` | `/ocr/process` | Image → runs OCR synchronously → returns `{ fields, confidence, raw_text, engine_used }` |
| `POST` | `/dedup/check` | Image + `record_id` → stores hash → returns `{ is_duplicate, similarity, matched_record_id? }` |

> **Async coordination:** FastAPI processes requests **synchronously** — it receives an image and returns a result directly. The async job queue (BullMQ + Redis) lives entirely in **Next.js**. A BullMQ worker in Next.js calls FastAPI via HTTP, receives the result, then writes `ocr_data` to PostgreSQL and updates `ocr_status`. The doctor's UI polls `/api/doctor/records/:id` until `ocr_status = 'done'`.

---

## 10. OCR Pipeline Design

### Configuration

```env
OCR_ENGINE=hybrid              # traditional | llm | hybrid
OCR_CONFIDENCE_THRESHOLD=0.80  # fallback to LLM below this
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.5-flash
PHASH_THRESHOLD=10             # max Hamming distance for pHash duplicate (0–64)
SEMANTIC_THRESHOLD=0.85        # min cosine similarity for semantic duplicate
```

### Traditional Path (Python FastAPI)

```
Input Image
    │
    ▼ OpenCV preprocessing
    ├─ Grayscale conversion
    ├─ Deskew (Hough transform)
    ├─ Adaptive thresholding (Otsu's)
    ├─ Denoising (fastNlMeansDenoising)
    └─ Contrast enhancement (CLAHE)
    │
    ▼ EasyOCR
    Raw text + bounding boxes + confidence scores per word
    │
    ▼ Field Extraction
    Regex patterns for: patient name, date, diagnosis, medications, dosage, doctor name
    │
    ▼ Medical Dictionary Normalization
    rapidfuzz matching against medication/diagnosis vocabulary
    │
    ▼ Confidence Scoring
    mean(per-word EasyOCR confidence scores) → aggregate confidence float 0.0–1.0
    │
    ▼ Output
    { fields: {...}, confidence: 0.0–1.0, raw_text: "..." }
```

### LLM Vision Path (Next.js → OpenRouter)

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

const MedicalRecordSchema = z.object({
  patient_name:  z.string().optional(),
  date:          z.string().optional(),
  diagnosis:     z.string().optional(),
  medications:   z.array(z.object({
    name:    z.string(),
    dosage:  z.string().optional(),
    frequency: z.string().optional(),
  })),
  doctor_name:   z.string().optional(),
  raw_text:      z.string(),
});

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const model = openrouter(process.env.OPENROUTER_MODEL, {
  plugins: [{ id: 'response-healing' }], // auto-fix malformed JSON
});

const { object } = await generateObject({
  model,
  schema: MedicalRecordSchema,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Extract all medical record fields from this image. Return only what is clearly visible.' },
      { type: 'image', image: imageBuffer },
    ],
  }],
});
```

### Hybrid Decision Logic

```
traditional_result = await fastapi.post('/ocr/process', image)

if traditional_result.confidence >= OCR_CONFIDENCE_THRESHOLD:
    return { ...traditional_result, ocr_engine: 'traditional' }
else:
    llm_result = await openrouter.generateObject(image)
    return { ...llm_result, ocr_engine: 'llm' }
```

---

## 11. Image Deduplication Design

### Stage 1 — Perceptual Hash (Fast, Exact/Near-Exact)

```python
import imagehash
from PIL import Image

phash = str(imagehash.phash(Image.open(image_path)))
# query existing hashes
existing = db.query("SELECT id, phash FROM image_hashes")
for record in existing:
    if imagehash.hex_to_hash(record.phash) - imagehash.hex_to_hash(phash) < PHASH_THRESHOLD:
        return { "is_duplicate": True, "matched_record_id": record.id }
```

### Stage 2 — Semantic Embedding (Handles Rotation, Crop, Lighting)

```python
import timm, torch
from sklearn.metrics.pairwise import cosine_similarity

model = timm.create_model('efficientnet_b0', pretrained=True, num_classes=0)
embedding = model(preprocess(image)).detach().numpy()

# pgvector cosine similarity query
result = db.execute("""
  SELECT record_id, 1 - (embedding <=> %s) AS similarity
  FROM image_hashes
  ORDER BY similarity DESC LIMIT 1
""", [embedding.tolist()])

if result.similarity >= SEMANTIC_THRESHOLD:  # 0.85
    return { "is_duplicate": True, "similarity": result.similarity }
```

---

## 12. RBAC & Consent System

### Role Permissions Matrix

| Resource | Superadmin | Admin | Doctor | Pharmacist | Patient |
|---|---|---|---|---|---|
| Manage institutions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Register doctors | ❌ | ✅ | ❌ | ❌ | ❌ |
| Approve consents | ❌ | ✅ | ❌ | ❌ | ❌ |
| Register patients | ❌ | ❌ | ✅ | ❌ | ❌ |
| Upload records | ❌ | ❌ | ✅ | ❌ | ❌ |
| View any record | ❌ | ❌ | ✅ (own patients) | ✅ (consent-gated) | ✅ (own only) |
| Grant/revoke consent | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ✅ | ✅ (own institution) | ❌ | ❌ | ❌ |

### Consent Gate Middleware

Two access patterns require different lookup strategies:

**By `patientCode`** — used on `GET /api/pharmacist/patients/:patientCode`:
```typescript
async function requireConsentByPatientCode(patientCode: string, pharmacyId: string) {
  const consent = await prisma.consents.findFirst({
    where: {
      patient: { patient_code: patientCode },
      pharmacy_id: pharmacyId,
      status: 'approved',
    },
    orderBy: { created_at: 'desc' },
  });
  if (!consent) throw new ForbiddenError('No active consent for this patient.');
}
```

**By `recordId`** — used on `GET /api/pharmacist/records/:id`:
```typescript
async function requireConsentByRecordId(recordId: string, pharmacyId: string) {
  // First resolve record → patient, then check consent
  const record = await prisma.medical_records.findUnique({
    where: { id: recordId },
    select: { patient_id: true },
  });
  if (!record) throw new NotFoundError('Record not found.');

  const consent = await prisma.consents.findFirst({
    where: {
      patient_id: record.patient_id,
      pharmacy_id: pharmacyId,
      status: 'approved',
    },
    orderBy: { created_at: 'desc' },
  });
  if (!consent) throw new ForbiddenError('No active consent for this patient.');
}
```

---

## 13. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Record retrieval latency | ≤ 3 seconds |
| OCR processing time (traditional) | ≤ 5 seconds per image |
| OCR processing time (LLM) | ≤ 10 seconds per image |
| Duplicate detection accuracy | ≥ 85% |
| System uptime | ≥ 99% (VPS) |
| Concurrent users | ≥ 50 simultaneous sessions |
| File size limit per upload | 10 MB |
| Supported image formats | JPG, PNG, WEBP, PDF (single-page) |

---

## 14. Success Criteria & Evaluation Metrics

### OCR Accuracy — Word Error Rate (WER)

```
WER = (Substitutions + Deletions + Insertions) / Total Reference Words
```

Measured against a ground-truth test set of 50+ manually transcribed medical records. Target: WER ≤ 15% for printed text, ≤ 30% for mixed/handwritten.

### Duplicate Detection Accuracy

Measured on a test set of 100 image pairs (50 true duplicates, 50 non-duplicates). Target: ≥ 85% F1 score.

### Usability — System Usability Scale (SUS)

Post-testing SUS survey administered to pilot users (doctors, pharmacists, patients). Target: SUS score ≥ 68 (above average).

### Performance

- All dashboard page loads ≤ 3s under normal load
- Consent grant/revoke reflected in UI within ≤ 1s

---

## 15. Security & Privacy

### Authentication
- NextAuth.js v5 with credential provider
- Bcrypt password hashing (cost factor ≥ 12)
- HTTP-only session cookies (no JWT in localStorage)
- Session expiry: 8 hours idle

### Data Encryption
- All data in transit: TLS 1.3 via Nginx + Let's Encrypt
- Sensitive patient PII fields (`full_name`, `date_of_birth`, `phone`, `email`, `photo_url`) encrypted at rest using **application-layer AES-256-GCM** in Next.js before writing to PostgreSQL. A `ENCRYPTION_KEY` (32-byte hex) is injected via environment variable. Prisma stores the ciphertext as `TEXT`; decryption happens in the API layer before returning data to clients. This approach is Prisma-compatible and avoids PostgreSQL extension dependencies.

### RA 10173 Compliance
- Patient consent required before any third-party access
- Right to revoke: consent revocation is immediate and system-enforced
- Audit logs retained for minimum 5 years
- Data minimization: pharmacist sees only prescription-relevant fields, not full EHR

### Input Validation
- All API inputs validated with Zod schemas
- File uploads: MIME type + magic bytes validation, 10 MB max
- SQL injection: prevented by Prisma parameterized queries
- XSS: Next.js auto-escaping + Content Security Policy header

---

## 16. Constraints & Risks

| Constraint / Risk | Mitigation |
|---|---|
| OCR accuracy depends on document quality | Hybrid strategy: LLM fallback for low-confidence extractions |
| VPS downtime affects all services | Docker health checks + restart policies; monitoring via Uptime Kuma |
| OpenRouter API cost (LLM path) | Only triggered when traditional confidence < threshold; use cheapest capable model (Gemini Flash) |
| `torch` + `timm` large image size in Python container | Use `torch` CPU-only wheels; multi-stage Docker build to reduce image size |
| No clinical decision support | System is record management only; no diagnosis recommendations |
| Web-based only | Responsive UI for mobile browsers; no native app |
| RA 10173 enforcement | Consent gate middleware + audit logging + data encryption |

---

*Document Version: 1.0 — 2026-03-13*

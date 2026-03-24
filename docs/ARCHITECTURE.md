# RxGuard System Architecture

> Computer Vision-Based Electronic Health Record System for Medical Record Digitization

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Infrastructure Topology](#2-infrastructure-topology)
- [3. Authentication & Authorization](#3-authentication--authorization)
- [4. Medical Record Upload & OCR Pipeline](#4-medical-record-upload--ocr-pipeline)
- [5. Deduplication System](#5-deduplication-system)
- [6. Hybrid OCR Engine](#6-hybrid-ocr-engine)
- [7. Consent Management](#7-consent-management)
- [8. Pharmacist Verification Flow](#8-pharmacist-verification-flow)
- [9. Notification System](#9-notification-system)
- [10. Data Model](#10-data-model)
- [11. Environment Configuration](#11-environment-configuration)

---

## 1. System Overview

RxGuard is a multi-service EHR platform that digitizes physical medical records using OCR, enforces consent-based pharmacist access under RA 10173 (Data Privacy Act of 2012), prevents duplicate uploads via perceptual hashing, and auto-generates patient digital ID cards.

```mermaid
graph TB
    subgraph Client
        Browser[Web Browser]
    end

    subgraph Reverse Proxy
        NGINX[NGINX :80]
    end

    subgraph Application Layer
        NextJS[Next.js 16 App<br/>React 19 + TypeScript<br/>:3000]
        OCR[FastAPI OCR Service<br/>Python 3.11<br/>:8000]
    end

    subgraph Job Processing
        BullMQ[BullMQ Worker<br/>Concurrency: 2]
        LLM[OpenRouter LLM<br/>Gemini 2.5 Flash]
    end

    subgraph Data Layer
        PG[(PostgreSQL 16<br/>+ pgvector<br/>:5432)]
        Redis[(Redis 7<br/>:6379)]
        MinIO[(MinIO S3<br/>:9000)]
    end

    Browser -->|HTTP/WS| NGINX
    NGINX -->|/* routes| NextJS
    NGINX -->|/ocr/* routes| OCR

    NextJS -->|Prisma ORM| PG
    NextJS -->|ioredis| Redis
    NextJS -->|AWS SDK S3| MinIO
    NextJS -->|Enqueue jobs| Redis

    BullMQ -->|Dequeue jobs| Redis
    BullMQ -->|Download images| MinIO
    BullMQ -->|POST /ocr/process| OCR
    BullMQ -->|Update results| PG
    BullMQ -->|Low confidence fallback| LLM

    OCR -->|EasyOCR + OpenCV| OCR
```

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, ShadCN v4 |
| Auth | NextAuth v5 (Credentials provider), JWT sessions, 5 roles |
| ORM | Prisma v7 with `@prisma/adapter-pg`, PostgreSQL 16 + pgvector |
| OCR Microservice | Python FastAPI, OpenCV, EasyOCR |
| LLM Fallback | OpenRouter API + Vercel AI SDK `generateObject` |
| Job Queue | BullMQ v5 + Redis 7 (ioredis) |
| Object Storage | MinIO (S3-compatible) via `@aws-sdk/client-s3` |
| PDF Generation | `@react-pdf/renderer` v4 |
| Validation | Zod v4, react-hook-form v7 |

---

## 2. Infrastructure Topology

### Docker Services

```mermaid
graph LR
    subgraph External
        User[User :80]
    end

    subgraph docker-compose
        NGINX[nginx<br/>nginx:alpine<br/>:80]
        Next[next<br/>Node 20-alpine<br/>:3000]
        OCR_SVC[ocr<br/>Python 3.11-slim<br/>:8000]
        Migrate[migrate<br/>Prisma deploy + seed<br/>runs once]
        PG[postgres<br/>pgvector:pg16<br/>:5432]
        Redis[redis<br/>redis:7-alpine<br/>:6379]
        MinIO[minio<br/>minio/minio<br/>:9000 / :9001]
        PGAdmin[pgadmin<br/>pgadmin4<br/>:5050]
    end

    User --> NGINX
    NGINX -->|/* | Next
    NGINX -->|/ocr/*| OCR_SVC
    Next --> PG
    Next --> Redis
    Next --> MinIO
    Next --> OCR_SVC
    Migrate -->|prisma migrate deploy| PG
    PGAdmin --> PG
```

### Service Startup Order

```mermaid
graph TD
    PG[PostgreSQL] -->|healthy| Migrate[Migrate Service]
    Redis[Redis] -->|healthy| Next[Next.js App]
    MinIO[MinIO] -->|healthy| Next
    Migrate -->|completed| Next
    OCR[OCR Service] -->|healthy| NGINX
    Next -->|ready| NGINX[NGINX]
```

**Production** (`docker-compose.prod.yml`):
- Adds explicit `migrate` service that runs `prisma migrate deploy && seed` before Next.js starts
- No pgAdmin service
- All health-check gated

**Development** (`docker-compose.dev.yml`):
- Volume mounts for hot reload on Next.js and OCR source
- All ports exposed to host (3000, 8000, 5432, 6379, 9000, 9001, 5050)
- OCR runs with `--reload`

### NGINX Routing

| Path | Upstream | Timeout |
|------|----------|---------|
| `/ocr/*` | `ocr:8000` | 60s |
| `/*` | `next:3000` | default |

WebSocket upgrade headers are forwarded for Next.js HMR in development.

---

## 3. Authentication & Authorization

### Login Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextAuth as NextAuth v5
    participant DB as PostgreSQL

    User->>Browser: Enter email + password
    Browser->>NextAuth: POST /api/auth/callback/credentials
    NextAuth->>NextAuth: Rate limit check (10 attempts / 900s)
    NextAuth->>DB: Find user by email (include institution)
    DB-->>NextAuth: User record + institution type
    NextAuth->>NextAuth: bcrypt.compare(password, hash)

    alt Invalid credentials
        NextAuth-->>Browser: 401 Unauthorized
    else Valid credentials
        NextAuth->>NextAuth: Build JWT token
        Note over NextAuth: Token contains: id, email, role,<br/>institutionId, institutionType,<br/>isActive, forcePasswordChange
        NextAuth-->>Browser: Set session cookie
        Browser->>Browser: Redirect to role dashboard
    end
```

### Session Structure

```typescript
interface Session {
  user: {
    id: string               // User UUID
    email: string
    role: UserRole           // superadmin | admin | doctor | pharmacist | patient
    institutionId: string    // Hospital or pharmacy UUID (nullable)
    institutionType: string  // hospital | pharmacy (nullable)
    isActive: boolean
    forcePasswordChange: boolean
  }
}
```

### Middleware Route Protection

```mermaid
flowchart TD
    A[Incoming Request] --> B{Public route?}
    B -->|Yes| C[Allow through]
    B -->|No| D{Has session?}
    D -->|No| E[Redirect /login]
    D -->|Yes| F{forcePasswordChange?}
    F -->|Yes| G[Redirect /change-password]
    F -->|No| H{Route matches role?}
    H -->|Yes| I[Allow through]
    H -->|No| J["Redirect to /{role}/dashboard"]
```

**Public routes** (no auth required):
`/login`, `/forgot-password`, `/reset-password`, `/api/auth/*`, `/api/health`, `/verify`, `/api/verify`

### Role-Based Access Matrix

| Role | Dashboard | Manages | Special Access |
|------|-----------|---------|----------------|
| **Superadmin** | `/superadmin/dashboard` | Institutions, all users | System-wide |
| **Admin** | `/admin/dashboard` | Doctors or pharmacists (by institution type) | Consent approvals, audit logs |
| **Doctor** | `/doctor/dashboard` | Patients, records | Upload, OCR review, signing |
| **Pharmacist** | `/pharmacist/dashboard` | Verifications | Consent-gated patient access |
| **Patient** | `/patient/dashboard` | Own consents | View own records, ID card |

---

## 4. Medical Record Upload & OCR Pipeline

### End-to-End Flow

```mermaid
sequenceDiagram
    actor Doctor
    participant API as POST /api/doctor/records
    participant Sharp as Sharp (Image Processing)
    participant OCR_SVC as FastAPI /dedup/hash
    participant DB as PostgreSQL
    participant S3 as MinIO
    participant Queue as BullMQ Queue
    participant Worker as OCR Worker
    participant OCR as FastAPI /ocr/process
    participant LLM as OpenRouter LLM

    Doctor->>API: Upload image (JPEG/PNG, max 10MB)
    API->>API: Validate auth, ownership, MIME type

    rect rgb(240, 248, 255)
        Note over API,Sharp: Image Preprocessing
        API->>Sharp: Resize (max 2048x2048) + convert to PNG
        Sharp-->>API: pngBuffer
    end

    rect rgb(255, 248, 240)
        Note over API,OCR_SVC: Deduplication Check
        API->>OCR_SVC: POST /dedup/hash (image)
        OCR_SVC-->>API: { phash: "64-char hex" }
        API->>DB: SELECT all existing pHashes
        API->>API: Hamming distance check (threshold ≤ 10)
    end

    API->>DB: CREATE MedicalRecord (ocrStatus: pending)
    API->>S3: Upload PNG as patientId/recordId.png
    API->>DB: CREATE ImageHash (phash)
    API->>Queue: Enqueue { recordId, minioKey }
    API->>DB: Audit log: UPLOAD_RECORD
    API-->>Doctor: 201 { id, ocrStatus: "pending", duplicateWarning? }

    rect rgb(240, 255, 240)
        Note over Worker,LLM: Async OCR Processing
        Worker->>DB: SET ocrStatus = "processing"
        Worker->>S3: Download image buffer
        Worker->>OCR: POST /ocr/process (image)
        OCR->>OCR: Preprocess → EasyOCR → Extract fields → Normalize
        OCR-->>Worker: { fields, confidence, raw_text, engine }

        alt confidence < 0.80 AND engine = hybrid
            Worker->>LLM: Vision extraction (base64 image)
            LLM-->>Worker: Structured fields (confidence: 1.0)
        end

        Worker->>DB: UPDATE record (ocrData, ocrConfidence, ocrEngine, ocrStatus: done)
    end
```

### Upload Endpoint Details

**`POST /api/doctor/records`**

| Step | Action | Details |
|------|--------|---------|
| 1 | Auth check | Doctor role, owns patient record |
| 2 | File validation | JPEG/PNG only, max 10 MB |
| 3 | Image resize | Sharp: max 2048x2048, convert to PNG |
| 4 | pHash compute | POST to `/dedup/hash` endpoint |
| 5 | Duplicate check | Hamming distance against all existing hashes |
| 6 | DB record create | `ocrStatus: pending` |
| 7 | MinIO upload | Key: `{patientId}/{recordId}.png` |
| 8 | Hash store | `ImageHash` table with phash |
| 9 | Job enqueue | BullMQ `ocr-processing` queue |
| 10 | Audit log | `UPLOAD_RECORD` with IP address |

### BullMQ Worker Configuration

| Setting | Value |
|---------|-------|
| Queue name | `ocr-processing` |
| Concurrency | 2 jobs |
| Lock duration | 120 seconds |
| Max attempts | 3 |
| Backoff | Exponential, 2s initial |
| Completed retention | Last 100 |
| Failed retention | Last 500 |

Worker initialization happens during Next.js instrumentation (`src/instrumentation.ts`), which runs only in the Node.js runtime (not Edge).

### Error Handling & Retries

```mermaid
flowchart TD
    A[Job Picked Up] --> B[Download from MinIO]
    B --> C[POST to OCR Service]
    C --> D{Response status?}

    D -->|200 OK| E[Parse result]
    D -->|400/422| F[Permanent failure]
    D -->|5xx / network| G[Throw error → retry]

    F --> H[Mark record: failed<br/>Save error detail<br/>No retry]

    G --> I{Attempts remaining?}
    I -->|Yes| J[Exponential backoff<br/>2s → 4s → 8s]
    J --> A
    I -->|No| K[Mark record: failed<br/>Log final error]

    E --> L{Confidence ≥ 0.80?}
    L -->|Yes| M[Save OCR result<br/>ocrStatus: done]
    L -->|No| N{Hybrid mode?}
    N -->|No| M
    N -->|Yes| O[Call LLM fallback]
    O --> P{LLM success?}
    P -->|Yes| Q[Save LLM result<br/>confidence: 1.0<br/>engine: llm]
    P -->|No| R[Keep low-confidence<br/>traditional result]
```

---

## 5. Deduplication System

### Perceptual Hash (pHash) Pipeline

```mermaid
flowchart LR
    A[Upload Image] --> B[Sharp Resize<br/>2048x2048 PNG]
    B --> C[POST /dedup/hash]
    C --> D[PIL Image → DCT]
    D --> E[16x16 Hash<br/>256 bits]
    E --> F[Hex String<br/>64 characters]
    F --> G[Compare vs DB]

    G --> H{Hamming distance<br/>≤ threshold?}
    H -->|Yes| I[Duplicate Warning<br/>similarity %]
    H -->|No| J[No duplicate]
```

### How It Works

1. **Hash computation**: The uploaded image is sent to the FastAPI `/dedup/hash` endpoint, which uses the `imagehash` library to compute a DCT-based perceptual hash (16x16 = 256 bits, stored as 64-character hex string).

2. **Comparison**: The JavaScript upload handler queries all existing `ImageHash` records and computes the Hamming distance (count of differing bits) between the new hash and each stored hash.

3. **Decision**: If the Hamming distance is ≤ `PHASH_THRESHOLD` (default: 10), a duplicate warning is generated with a similarity percentage. The upload continues regardless — this is a **warning-only** feature.

### Hamming Distance Implementation

```
distance = 0
for each hex digit pair (new, existing):
    XOR the digits
    count set bits in result
    add to distance

similarity = (1 - distance / 64) * 100%
```

| Distance | Interpretation |
|----------|----------------|
| 0 | Identical images |
| 1–10 | Very similar (compression, minor rotation) |
| 11–20 | Somewhat similar |
| > 20 | Different documents |

### Storage

The `ImageHash` table also includes an `embedding VECTOR(512)` column (pgvector) prepared for future ViT-based semantic deduplication, with an IVFFLAT index ready for fast vector search.

---

## 6. Hybrid OCR Engine

### Processing Pipeline (FastAPI Service)

```mermaid
flowchart TD
    A[Input Image<br/>PNG/JPEG] --> B[PIL → NumPy → BGR]

    subgraph Preprocessing
        B --> C[Grayscale Conversion]
        C --> D[Denoising<br/>fastNlMeans h=10]
        D --> E[CLAHE Contrast<br/>clipLimit=2.0]
    end

    subgraph Text Extraction
        E --> F[EasyOCR readtext<br/>English, CPU mode]
        F --> G[Spatial Sort<br/>Y-coord then X-coord]
        G --> H[Line Grouping<br/>median_height × 0.6 gap]
        H --> I[Line Reconstruction<br/>left-to-right joining]
    end

    subgraph Field Extraction
        I --> J[Regex Pattern Matching]
        J --> K[patient_name]
        J --> L[date]
        J --> M[diagnosis]
        J --> N[medications]
        J --> O[doctor_name]
    end

    subgraph Normalization
        K & M & N --> P[RapidFuzz WRatio<br/>threshold: 80]
        P --> Q[Match against<br/>medication/diagnosis<br/>vocabularies]
    end

    subgraph Confidence
        F --> R[Per-word scores]
        R --> S[Mean → 0.0-1.0]
    end

    Q --> T[OcrFields Response]
    S --> T
```

### OCR Field Extraction Patterns

| Field | Regex Pattern | Fallback |
|-------|--------------|----------|
| Patient Name | `(?:patient\s*(?:name)?|name\s*of\s*patient|pt|px)\s*[:\-.]?\s*(.*)` | Next line if noise |
| Date | Multiple formats: ISO, US slash, dashed, text month | — |
| Diagnosis | `(?:diagnosis|dx|impression|assessment)\s*[:\-]?\s*(.*)` | Next line if noise |
| Doctor Name | `(?:physician|doctor|attending|prescribed\s*by)\s*[:\-.]?\s*(.*)` | `Dr. + Name` pattern |
| Medications | Dosage pattern: `(\d+)\s*(mg|mcg|ml|g|tabs?|...)` per line | — |

### OCR Digit Correction

Near dosage units (mg, mcg, ml, g), common OCR misreads are auto-corrected:
- `O` → `0`, `I` → `1`, `l` → `1`
- Example: `"lOmg"` becomes `"10mg"`

### Hybrid Decision Tree

```mermaid
flowchart TD
    A[Traditional OCR Result] --> B{confidence ≥ 0.80?}
    B -->|Yes| C[Use Traditional Result<br/>engine: traditional]
    B -->|No| D{OCR_ENGINE = hybrid?}
    D -->|No| C
    D -->|Yes| E{OPENROUTER_API_KEY set?}
    E -->|No| C
    E -->|Yes| F[Call OpenRouter LLM<br/>Vision model + structured output]
    F --> G{LLM success?}
    G -->|Yes| H[Use LLM Result<br/>confidence: 1.0<br/>engine: llm]
    G -->|No| I[Keep Traditional Result<br/>with low confidence warning]
```

**LLM Fallback Details:**
- Provider: OpenRouter
- Default model: `google/gemini-2.5-flash`
- Method: `generateObject()` with Zod schema validation
- Input: base64-encoded PNG as vision data URL
- Output: schema-validated `MedicalRecordFields` object

---

## 7. Consent Management

### Consent Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: Patient requests access<br/>for a pharmacy

    pending --> approved: Pharmacy admin approves
    pending --> rejected: Pharmacy admin rejects
    pending --> [*]: Patient cancels<br/>(record deleted)

    approved --> revoked: Patient revokes

    rejected --> pending: Patient renews<br/>(new consent created)
    revoked --> pending: Patient renews<br/>(new consent created)

    note right of approved
        Pharmacists at this pharmacy
        can now access patient records
        (until expiry or revocation)
    end note

    note right of rejected
        Admin must provide
        rejection reason
    end note
```

### Consent Request Flow

```mermaid
sequenceDiagram
    actor Patient
    participant PatientUI as Patient Consents Page
    participant API as POST /api/patient/consents
    participant DB as PostgreSQL
    participant Email as Nodemailer
    participant Notif as Notifications

    Patient->>PatientUI: Select pharmacy + optional expiry
    PatientUI->>API: { pharmacyId, expiresAt? }
    API->>API: Rate limit (10 req / 3600s)
    API->>DB: Verify pharmacy exists (type = pharmacy)
    API->>DB: Check no duplicate active/pending consent
    API->>DB: CREATE Consent (status: pending)
    API->>DB: Audit log: GRANT_CONSENT

    par Notifications
        API->>Email: Email all pharmacy admins
        API->>Notif: In-app notification to admins
    end

    API-->>PatientUI: 201 Created
```

### Consent Approval Flow

```mermaid
sequenceDiagram
    actor Admin as Pharmacy Admin
    participant API as PATCH /api/admin/consents/id
    participant DB as PostgreSQL
    participant Email as Nodemailer
    participant Notif as Notifications

    Admin->>API: { action: "approve" | "reject", rejectionReason? }
    API->>DB: Verify admin belongs to consent's pharmacy
    API->>DB: Verify consent status = pending

    alt Approve
        API->>DB: UPDATE status=approved, grantedAt=now, approvedBy=adminId
        API->>DB: Audit log: APPROVE_CONSENT
    else Reject
        API->>DB: UPDATE status=rejected, revokedAt=now, rejectionReason
        API->>DB: Audit log: REJECT_CONSENT
    end

    par Notifications
        API->>Email: Email patient (fire-and-forget)
        API->>Notif: In-app notification to patient
    end

    API-->>Admin: 200 OK
```

### Consent Validation (Access Gate)

Every pharmacist access to patient data goes through a consent gate:

```typescript
// src/lib/consent-gate.ts
async function requireConsent(patientId, pharmacyId) {
  // 1. Find approved consent for patient-pharmacy pair
  // 2. Check expiration (expiresAt < now → 403)
  // 3. Throw ConsentError(403) if not found
}
```

---

## 8. Pharmacist Verification Flow

### End-to-End Pharmacist Workflow

```mermaid
sequenceDiagram
    actor Pharmacist
    participant Search as GET /api/pharmacist/patients/code
    participant Gate as Consent Gate
    participant Record as GET /api/pharmacist/records/id
    participant Verify as POST /api/pharmacist/verifications
    participant Action as PATCH /api/pharmacist/verifications/id
    participant DB as PostgreSQL
    participant Notif as Notifications

    Pharmacist->>Search: Enter patient code (e.g. RX-1234)
    Search->>Gate: requireConsent(patientId, pharmacyId)
    Gate->>DB: Check approved + non-expired consent

    alt No valid consent
        Gate-->>Pharmacist: 403 Forbidden
    else Consent valid
        Search-->>Pharmacist: Patient info + record list
    end

    Pharmacist->>Record: View specific record
    Record->>Gate: requireConsentByRecordId(recordId, pharmacyId)
    Record-->>Pharmacist: Filtered OCR data + image

    Note over Pharmacist: Reviews prescription

    Pharmacist->>Verify: { recordId }
    Verify->>Gate: Consent check
    Verify->>DB: Check no duplicate verification
    Verify->>DB: CREATE PrescriptionVerification (status: verified)
    Verify-->>Pharmacist: Verification created

    alt Dispense
        Pharmacist->>Action: { action: "dispense" }
        Action->>DB: UPDATE status=dispensed, dispensedAt=now
        Action->>Notif: Notify doctor (email + in-app)
    else Reject
        Pharmacist->>Action: { action: "reject", rejectionReason }
        Action->>DB: UPDATE status=rejected, reason
        Action->>Notif: Notify doctor (email + in-app)
    end
```

### Verification States

```mermaid
stateDiagram-v2
    [*] --> verified: Pharmacist verifies prescription
    verified --> dispensed: Pharmacist dispenses medication
    verified --> rejected: Pharmacist rejects prescription
```

### Data Filtering for Pharmacists

Pharmacists receive a **filtered view** of medical records. Only these fields are exposed:

| Field | Visible | Reason |
|-------|---------|--------|
| `medications` | Yes | Required for dispensing |
| `doctor_name` | Yes | Verify prescriber |
| `date` | Yes | Check recency |
| `record_type` | Yes | Context |
| `patient_name` | No | Available from patient profile |
| `diagnosis` | No | Not needed for dispensing |
| `raw_text` | No | Sensitive |

---

## 9. Notification System

### Notification Architecture

```mermaid
flowchart LR
    subgraph Triggers
        A[Consent Requested]
        B[Consent Approved/Rejected]
        C[Prescription Dispensed]
        D[Prescription Rejected]
    end

    subgraph Delivery
        E[createNotification<br/>single user]
        F[createNotificationsForRole<br/>all users with role at institution]
    end

    subgraph Channels
        G[In-App<br/>Notification table]
        H[Email<br/>Nodemailer SMTP]
    end

    A --> F --> G & H
    B --> E --> G & H
    C --> E --> G & H
    D --> E --> G & H
```

### Notification Types

| Type | Recipient | Trigger |
|------|-----------|---------|
| `CONSENT_REQUESTED` | Pharmacy admins | Patient requests consent |
| `CONSENT_APPROVED` | Patient | Admin approves consent |
| `CONSENT_REJECTED` | Patient | Admin rejects consent |
| `PRESCRIPTION_DISPENSED` | Doctor (uploader) | Pharmacist dispenses |
| `PRESCRIPTION_REJECTED` | Doctor (uploader) | Pharmacist rejects |
| `WELCOME` | New user | Account creation |

### API Endpoints

| Method | Endpoint | Action |
|--------|----------|--------|
| `GET` | `/api/notifications` | List all (max 50) + unread count |
| `PATCH` | `/api/notifications/{id}` | Mark single as read |
| `POST` | `/api/notifications` | `{ action: "mark-all-read" }` |

---

## 10. Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    Institution ||--o{ User : "has staff"
    Institution {
        uuid id PK
        string name
        enum type "hospital | pharmacy"
        string address
        boolean isActive
    }

    User ||--o| Patient : "has profile"
    User ||--o{ MedicalRecord : "uploads"
    User ||--o{ MedicalRecord : "signs"
    User ||--o{ PrescriptionVerification : "verifies"
    User ||--o{ Consent : "approves"
    User ||--o{ AuditLog : "performs"
    User ||--o{ Notification : "receives"
    User {
        uuid id PK
        string email UK
        string password "bcrypt hash"
        enum role "superadmin|admin|doctor|pharmacist|patient"
        uuid institutionId FK
        boolean isActive
        boolean forcePasswordChange
    }

    Patient ||--o{ MedicalRecord : "owns"
    Patient ||--o{ Consent : "grants"
    Patient {
        uuid id PK
        string patientCode UK "RX-XXXX"
        string fullName "AES encrypted"
        string phone "AES encrypted"
        string email "AES encrypted"
        string dateOfBirth "AES encrypted"
        string photoUrl
        uuid userId FK
        uuid registeredBy FK
    }

    MedicalRecord ||--o| ImageHash : "has hash"
    MedicalRecord ||--o{ PrescriptionVerification : "verified by"
    MedicalRecord {
        uuid id PK
        uuid patientId FK
        uuid uploadedBy FK
        uuid institutionId FK
        string imageUrl "MinIO key"
        enum ocrStatus "pending|processing|done|failed"
        enum ocrEngine "traditional|llm"
        json ocrData "structured fields"
        float ocrConfidence
        enum signatureStatus "unsigned|signed"
        uuid signedBy FK
    }

    ImageHash {
        uuid id PK
        uuid recordId FK "unique"
        string phash "64-char hex"
        vector embedding "VECTOR 512 - future"
    }

    Consent {
        uuid id PK
        uuid patientId FK
        uuid pharmacyId FK
        uuid approvedBy FK
        enum status "pending|approved|rejected|revoked"
        datetime grantedAt
        datetime revokedAt
        datetime expiresAt
        string rejectionReason
    }

    PrescriptionVerification {
        uuid id PK
        uuid recordId FK
        uuid pharmacistId FK
        enum status "verified|dispensed|rejected"
        datetime dispensedAt
        string rejectionReason
    }

    AuditLog {
        uuid id PK
        uuid userId FK
        string action
        string resourceType
        uuid resourceId
        string ipAddress
        json metadata
    }

    Notification {
        uuid id PK
        uuid userId FK
        string type
        json payload
        boolean isRead
    }
```

### Key Enums

```
UserRole:           superadmin | admin | doctor | pharmacist | patient
InstitutionType:    hospital | pharmacy
OcrStatus:          pending | processing | done | failed
OcrEngine:          traditional | llm
SignatureStatus:    unsigned | signed
ConsentStatus:      pending | approved | rejected | revoked
VerificationStatus: verified | dispensed | rejected
```

### Data Encryption

Patient PII fields (`fullName`, `phone`, `email`, `dateOfBirth`) are encrypted at rest using AES-256 with the `ENCRYPTION_KEY` environment variable (64 hex chars = 32 bytes). Decryption happens at the application layer when data is read.

---

## 11. Environment Configuration

### Database & Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis for BullMQ job queue |
| `MINIO_ENDPOINT` | `localhost` / `minio` | MinIO S3 host |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_ACCESS_KEY` | — | S3 access key |
| `MINIO_SECRET_KEY` | — | S3 secret key |
| `MINIO_BUCKET_RECORDS` | `medical-records` | Medical record images bucket |
| `MINIO_BUCKET_IDCARDS` | `id-cards` | Patient ID card images bucket |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_SECRET` | — | NextAuth JWT signing key (32+ chars) |
| `AUTH_TRUST_HOST` | — | Trust proxy headers |
| `AUTH_URL` | `http://localhost:3000` | Canonical app URL |
| `ENCRYPTION_KEY` | — | AES-256 key (64 hex chars) |

### OCR Service

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_SERVICE_URL` | `http://localhost:8000` | FastAPI OCR endpoint |
| `OCR_ENGINE` | `hybrid` | Mode: `traditional` / `llm` / `hybrid` |
| `OCR_CONFIDENCE_THRESHOLD` | `0.80` | LLM fallback trigger threshold |
| `PHASH_THRESHOLD` | `10` | Hamming distance for duplicate detection |
| `SEMANTIC_THRESHOLD` | `0.85` | Semantic matching threshold |
| `OPENROUTER_API_KEY` | — | OpenRouter API key (empty = LLM disabled) |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | LLM vision model |

### Email

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Mail server |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `EMAIL_FROM` | `noreply@rxguard.local` | Sender address |

### Network Configuration (Docker)

| Context | OCR URL | Redis URL | MinIO Endpoint |
|---------|---------|-----------|----------------|
| Local dev | `http://localhost:8000` | `redis://localhost:6379` | `localhost` |
| Docker internal | `http://ocr:8000` | `redis://redis:6379` | `minio` |

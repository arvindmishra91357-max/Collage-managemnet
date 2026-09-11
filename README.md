# Mishra Group Institute (MGI) — College Management Portal

> **Division 3CYBER7 (B.Tech Cyber Security)**  
> Complete Multi-Platform Architecture: **Responsive Web + Native Android App + Real-Time Live Backend + PostgreSQL Production Database**

---

## Table of Contents
1. [Project Architecture](#1-project-architecture)
2. [Local Setup & Installation](#2-local-setup--installation)
3. [Environment Variables Configuration](#3-environment-variables-configuration)
4. [Database Setup (PostgreSQL Production & SQLite Local)](#4-database-setup)
5. [Production Deployment Guide (Render / Cloud)](#5-production-deployment-guide)
6. [Android Build & Release Instructions](#6-android-build--release-instructions)
7. [API Configuration & Endpoint Reference](#7-api-configuration--endpoint-reference)
8. [Admin Setup & Initial Credentials](#8-admin-setup--initial-credentials)
9. [Troubleshooting & Health Monitoring](#9-troubleshooting--health-monitoring)
10. [Backup, Persistence & Recovery Instructions](#10-backup-persistence--recovery-instructions)

---

## 1. Project Architecture

The Mishra Group Institute College Management Portal operates on a **Single Source of Truth** paradigm:

```
            ┌──────────────────────────────────────────────┐
            │       Android Mobile Application (APK)       │
            │   (Offline-First Cache + WebSockets / SSE)   │
            └──────────────────────┬───────────────────────┘
                                   │
                                   │ HTTPS REST API + SSE
                                   ▼
            ┌──────────────────────────────────────────────┐
            │         Production Node/Express Server       │
            │   (Authentication, Rate Limiter, SSE Bus)    │
            └──────────────┬───────────────────────────────┘
                           │
             ┌─────────────┴──────────────┐
             ▼                            ▼
  ┌──────────────────────┐      ┌───────────────────────────┐
  │ Managed PostgreSQL   │      │ Persistent Storage Service│
  │ Production Database  │      │ - Tier 1: Supabase/S3     │
  │ (Data + file_blobs)  │      │ - Tier 2: DB file_blobs   │
  └──────────────────────┘      │ - Tier 3: Local disk cache│
             ▲                  └───────────────────────────┘
             │
             │ HTTPS REST API + SSE
             │
  ┌──────────┴────────────────────────────┐
  │   Responsive Web Application (PWA)    │
  │   (Student Portal + Admin Dashboard)  │
  └───────────────────────────────────────┘
```

### Core Architecture Principles:
- **One Backend, One Database**: The Android app and Web portal communicate with the exact same Node.js/Express REST API and PostgreSQL database.
- **Real-Time Synchronization (SSE)**: When an Admin modifies a room (`114 → 208`), posts an announcement, uploads notes, or cancels a lecture, a Server-Sent Event (`SSE`) broadcasts instantly to all active web and Android clients.
- **Push Notifications**: Live updates trigger device notifications and vibrations on student phones.
- **Multi-Tier File Persistence**: Uploaded PDFs, study notes, and profile photos are persisted in PostgreSQL (`file_blobs` table) and recovered automatically across container redeployments and restarts.
- **Offline Resilience**: Timetable, student profile, attendance summary, and academic metadata are cached locally so students in low-connectivity areas can always access their schedule.

---

## 2. Local Setup & Installation

### Prerequisites:
- **Node.js**: v18.x or v20.x LTS
- **Git**
- **Java JDK 17+** and **Android SDK Build-Tools 35.0.0** (required only for building the Android APK)

### Steps:
1. **Clone the repository:**
   ```bash
   git clone https://github.com/arvindmishra91357-max/Collage-managemnet.git
   cd Collage-managemnet
   ```

2. **Install backend dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Start development server:**
   ```bash
   npm run dev
   # or
   npm start
   ```

5. **Access the portal:**
   - Web Portal: `http://localhost:3000`
   - Health Monitor: `http://localhost:3000/api/health`

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env`. Production environments should configure these in the cloud host dashboard (e.g. Render Dashboard):

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `PORT` | No | `3000` | Port for the Express server (Render sets to `10000`). |
| `NODE_ENV` | Yes | `production` | Set to `production` or `development`. |
| `DATABASE_URL` | Yes (Prod) | `""` | Full PostgreSQL connection string (`postgres://...`). If empty, falls back to local SQLite. |
| `JWT_SECRET` | Yes | Auto | 64+ char secret key for signing JSON Web Tokens. |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed origins. |
| `KEEP_ALIVE_URL` | No | `""` | Endpoint pinged periodically to eliminate Render free tier cold-starts. |
| `KEEP_ALIVE_INTERVAL_MS`| No | `300000` (5 min) | Frequency of anti-cold-start pings. |
| `STORAGE_PROVIDER` | No | `db` | File storage driver: `db` (Postgres BLOB), `supabase`, `s3`, or `local`. |
| `SUPABASE_URL` | Optional | `""` | Supabase API endpoint (if using Supabase storage). |
| `SUPABASE_KEY` | Optional | `""` | Supabase service key. |
| `SUPABASE_BUCKET`| Optional | `mgi-uploads` | Bucket name for uploaded documents. |

---

## 4. Database Setup

### Local Development (Zero-Config SQLite)
When `DATABASE_URL` is omitted, the server automatically boots an embedded SQLite database (`college_portal.sqlite`) and runs all seed tables, admin credentials, and mock timetable records.

### Production (Managed PostgreSQL)
Set `DATABASE_URL`:
```bash
DATABASE_URL=postgres://user:password@hostname:5432/mgi_portal?sslmode=require
```

The database adapter in `server/db.js` automatically:
1. Configures connection pooling (min 2, max 20 connections).
2. Enables SSL certificate tolerance (`rejectUnauthorized: false`) for cloud databases (Render, Supabase, Neon, AWS RDS).
3. Applies schema migrations idempotently on startup (`CREATE TABLE IF NOT EXISTS`).
4. Creates necessary performance indexes:
   - `idx_students_ug_id`
   - `idx_students_batch`
   - `idx_timetable_day_batch`
   - `idx_attendance_records_session_ug`
   - `idx_class_notes_subject`
   - `idx_file_blobs_path`
5. Probes database health actively via `db.ping()`.

---

## 5. Production Deployment Guide

The repository includes a ready-to-use `render.yaml` specification for zero-downtime deployment on Render:

### Deploying to Render:
1. Push changes to GitHub `main` branch.
2. Log in to [Render.com](https://render.com).
3. Click **New +** → **Blueprint**.
4. Select your `Collage-managemnet` GitHub repository.
5. Render reads `render.yaml` and provisions:
   - **`mgi-postgres-db`**: A managed PostgreSQL database.
   - **`mishra-group-institute-portal`**: Node.js web service linked to the database.
   - Automatically injects `DATABASE_URL` and generates a secure `JWT_SECRET`.
6. Click **Apply**.
7. Once deployed, the service runs health checks against `/api/health`.

### Automated Anti-Sleep Keep-Alive:
In `server/server.js`, an internal keep-alive loop runs every 5 minutes targeting `KEEP_ALIVE_URL` to ensure the server remains warm and responsive for students during college hours.

---

## 6. Android Build & Release Instructions

The native Android app uses an embedded WebView layer loaded from `android_asset/www`, communicating securely with the production cloud API (`https://mishra-group-institute-portal.onrender.com`).

### Packaging the Signed Release APK:
Run the automated packaging engine from PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\package_apk.ps1
```

### What `package_apk.ps1` does:
1. **Syncs Assets**: Copies latest `public/` web assets (`api.js`, `studentApp.js`, `index.html`) into `staging_apk/assets/www/`.
2. **Validates Bytecode**: Verifies compiled `classes.dex` (with Android Camera, Geolocation, and DownloadManager hooks).
3. **Builds Archive**: Compiles uncompressed `resources.arsc` and creates `android-build/unaligned.apk` via `ApkPackager.cs`.
4. **Zipaligns**: Aligns 4-byte boundaries using `zipalign.exe -p 4`.
5. **Signs Release**: Generates 2048-bit RSA keystore and signs with **v1, v2, and v3 signature schemes** via `apksigner.jar`.
6. **Deploys**: Copies the signed release APK to:
   - `MGI_Student_Portal.apk` (root)
   - `public/apk/MGI_Student_Portal.apk` (available for direct download from web portal)

---

## 7. API Configuration & Endpoint Reference

### Authentication
- `POST /api/auth/login` — Student / Admin login with UG ID or email.
- `POST /api/auth/forgot-password` — Verify UG ID + Mobile to securely reset password.
- `POST /api/auth/change-password` — Change password for authenticated session.
- `POST /api/auth/upload-photo` — Update student profile photo.

### Student Endpoints
- `GET /api/student/profile` — Fetch student information.
- `GET /api/student/timetable` — Today's and weekly timetable + room overrides.
- `GET /api/student/attendance` — Subject-wise and cumulative attendance breakdown.
- `POST /api/attendance/scan` — Submit cryptographic QR attendance token.
- `GET /api/student/notes` — Subject notes and downloadable PDFs.
- `GET /api/student/assignments` — Homework & project assignments with deadlines.
- `GET /api/student/results` — Semester examination results.
- `GET /api/student/notifications` — Notification inbox.

### Admin Endpoints
- `POST /api/admin/students` — Register new student with UG ID.
- `POST /api/admin/timetable/room-change` — Emergency room change broadcast.
- `POST /api/admin/notes/upload` — Upload syllabus & notes with persistent storage.
- `POST /api/admin/assignments/create` — Post assignment with submission deadline.
- `POST /api/admin/notifications/broadcast` — Send instant alert to division/all.

### System & Real-Time
- `GET /api/health` — Returns DB status, latency, uptime, and SSE clients.
- `GET /api/realtime/events` — Server-Sent Events stream for instant client updates.

---

## 8. Admin Setup & Initial Credentials

### Default Admin Credentials (Seed):
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: `admin`

> **Note**: Upon first login, navigate to the Profile/Security section and update the admin password.

### Student Login:
- **Username**: Student UG ID (e.g. `UG2023001` or student roll number).
- **Default Password**: Set by admin during onboarding (or `password123`).
- **Reset**: Accessible via the "Forgot Password?" dialog on the login screen.

---

## 9. Troubleshooting & Health Monitoring

### Health Endpoint (`/api/health`)
Visit `https://mishra-group-institute-portal.onrender.com/api/health`:
```json
{
  "status": "healthy",
  "database": {
    "status": "connected",
    "engine": "postgresql",
    "latencyMs": 24
  },
  "sse": {
    "activeClients": 14
  },
  "storage": {
    "provider": "db"
  },
  "uptime": 86400
}
```

### Common Issues & Resolutions:
1. **Student cannot connect (Offline banner visible)**:
   - The app detects loss of connection and serves cached timetable and profile records automatically. When network recovers, it syncs immediately.
2. **File missing after container restart**:
   - The storage subsystem automatically pulls the binary from the PostgreSQL `file_blobs` table and restructures the local cache transparently.
3. **QR Attendance rejected**:
   - Check if session has expired (attendance QR codes are time-windowed) or if the student was already marked present.

---

## 10. Backup, Persistence & Recovery Instructions

### PostgreSQL Backup:
Export production database dump:
```bash
pg_dump "postgres://user:password@host/mgi_portal" > mgi_portal_backup.sql
```

### Restore Database:
```bash
psql "postgres://user:password@host/mgi_portal" < mgi_portal_backup.sql
```

### File Storage Persistence:
All academic notes, assignments, and profile images uploaded through the portal are serialized into `file_blobs`. Backing up the PostgreSQL database automatically protects all uploaded files without requiring separate disk backup procedures.

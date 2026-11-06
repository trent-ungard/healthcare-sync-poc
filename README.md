# Healthcare Real-Time Sync PoC

A proof-of-concept TypeScript service that enables real-time synchronization between disconnected healthcare systems (EHR, HR, scheduling). Demonstrates event ingestion, validation, CRDT-based conflict resolution, HIPAA-aware permission tagging, and downstream event emission.

## Architecture

```
┌──────────┐     ┌──────────┐
│ System A  │     │ System B  │
│  (EHR)    │     │  (HR)     │
└────┬──────┘     └──────┬────┘
     │  REST POST        │  REST POST
     ▼                   ▼
┌──────────────────────────────┐
│          Kafka               │
│  sync.inbound.ehr / .hr      │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│     Sync Service             │
│  1. Validate (explicit rules)│
│  2. AI Notes check (mock)    │
│  3. CRDT merge (LWW/field)   │
│  4. Persist to Postgres      │
│  5. Audit log                │
│  6. Permission tag           │
│  7. Emit downstream          │
└──────┬──────────────┬────────┘
       │              │
       ▼              ▼
   Kafka outbound   Socket.IO
   topics            → UI updates
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local dev without Docker)

### Run with Docker Compose

```bash
docker-compose up --build
```

Then open http://localhost:5173 in your browser.

### Run Locally (development)

1. Start infrastructure:
```bash
docker-compose up -d zookeeper kafka postgres
```

2. Install dependencies:
```bash
cd shared && npm install && cd ..
cd service && npm install && cd ..
cd ui && npm install && cd ..
```

3. Start the service:
```bash
cd service && npm run dev
```

4. In another terminal, start the UI:
```bash
cd ui && npm run dev
```

5. Open http://localhost:5173

## Demo Walkthrough

### 1. Happy Path: Phone Number Sync
- In **System A (EHR)**, change Sarah Johnson's phone number to `555-999-8888`
- Click **Save Changes**
- Watch **System B (HR)** update automatically
- Event Log shows green "Applied" entry

### 2. Validation Error: Invalid Phone Format
- Enter `12345` as a phone number
- Click Save
- Event Log shows red "Validation Failed" — phone must be XXX-XXX-XXXX format

### 3. AI Notes Flagging: Shift Conflict
- Change Sarah's shift from "1st" to "Nights"
- The mock AI detects her notes say "prefers morning shifts"
- Event Log shows red "Validation Failed" with AI reasoning

### 4. CRDT Conflict Resolution
- Change phone in System A, then immediately change it in System B
- The Last-Writer-Wins register resolves by timestamp
- Loser gets a yellow "Conflict" entry in the Event Log

### 5. Permission Redaction
- Switch the **Role** dropdown from Admin to Nurse
- Patient diagnosis field becomes "[REDACTED - insufficient permissions]"
- Switch to Read-Only — most fields are redacted

## Key Concepts

### CRDT: Last-Writer-Wins Register Per Field
Each field has its own timestamp. When two systems update the same field, the newer timestamp wins. This is implemented as a single atomic SQL statement:

```sql
INSERT INTO field_timestamps ...
ON CONFLICT DO UPDATE ... WHERE updated_at < EXCLUDED.updated_at
```

### Conflict Resolution Strategy
Concurrent edits are handled by LWW-per-field. Every update attempt (including rejected ones) is recorded in the audit log with full context. This means:
- No data is silently lost
- Administrators can review conflicts after the fact
- The "loser" system receives a conflict notification via Socket.IO

### Validation Layers
1. **Explicit rules** — regex, enum, required (stored in DB, cached at startup)
2. **AI notes parsing** — mock LLM that pattern-matches free-text notes for implicit constraints

### Permission Tagging (HIPAA)
Events carry `accessControl` metadata with `visibleFields` and `redactedFields` per role. Downstream systems use this to filter what each user can see. The service itself enforces this on all API responses and Socket.IO emissions.

### Dead Letter Queue
Failed downstream events go to a Postgres-backed DLQ with exponential retry (30s → 60s → 120s, max 3 attempts). Exhausted items trigger a Datadog alert.

### Polling Fallback
For systems that can't emit real-time events, a `Poller` class periodically diffs against a data source and produces SyncEvents to Kafka. Toggle with `ENABLE_POLLING=true`.

## Project Structure

```
healthcare-sync-poc/
├── shared/src/          # Shared types, permissions, topic constants
├── service/src/
│   ├── ingestion/       # Core pipeline (event-handler.ts) + poller
│   ├── validation/      # Explicit rules engine + mock AI notes
│   ├── crdt/            # LWW register per field
│   ├── kafka/           # Producer, consumer, DLQ
│   ├── permissions/     # Access control tagger
│   ├── monitoring/      # Datadog StatsD client (mock mode)
│   ├── db/              # Postgres pool + queries
│   └── routes/          # REST API
├── ui/src/              # React demo UI
├── init-db.sql          # Schema + seed data
└── docker-compose.yml   # Full local stack
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Service port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/healthcare_sync` | Postgres connection |
| `KAFKA_BROKERS` | `localhost:9092` | Kafka broker list |
| `DD_AGENT_HOST` | _(empty = mock)_ | Datadog agent host |
| `ENABLE_POLLING` | `false` | Enable polling fallback |
| `VITE_API_URL` | _(empty = proxy)_ | API URL for UI |

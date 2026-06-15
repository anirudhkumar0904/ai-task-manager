# AI-Powered Task & Knowledge Management System

A full-stack web application that combines task management with AI-driven semantic document search. Admins build a knowledge base by uploading documents; users search it with natural language and complete assigned tasks.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2.0 |
| **Database** | MySQL 8.0 (relational schema with FK constraints) |
| **AI / Search** | `sentence-transformers` (all-MiniLM-L6-v2) + FAISS flat index |
| **Auth** | JWT (python-jose) + bcrypt password hashing |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **State** | Zustand (auth), React Query (server state) |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Containers** | Docker + Docker Compose + Nginx |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   React Frontend                  │
│  Pages: Dashboard · Tasks · Documents · Search   │
│         Analytics · Users (admin)                 │
└────────────────────┬─────────────────────────────┘
                     │ HTTP / REST (JWT Bearer)
┌────────────────────▼─────────────────────────────┐
│              FastAPI Backend                      │
│                                                   │
│  /auth    /tasks    /documents                    │
│  /search  /analytics  /users                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         Embedding Service (singleton)        │ │
│  │  SentenceTransformer → L2-norm → FAISS IP   │ │
│  │  Chunks persisted to disk (faiss.index +    │ │
│  │  chunks.json) — survives restarts           │ │
│  └─────────────────────────────────────────────┘ │
└──────────┬──────────────────────┬────────────────┘
           │                      │
    ┌──────▼──────┐      ┌────────▼────────┐
    │   MySQL 8   │      │   FAISS Index   │
    │  (5 tables) │      │  (disk-backed)  │
    └─────────────┘      └─────────────────┘
```

---

## Database Schema

```sql
roles        (id, name, description, created_at)
users        (id, name, email, hashed_password, role_id→roles, is_active, created_at)
tasks        (id, title, description, status, priority, assigned_to_id→users,
              created_by_id→users, due_date, created_at, updated_at)
documents    (id, title, original_filename, file_path, file_size, mime_type,
              content_preview, chunk_count, is_indexed, uploaded_by_id→users, created_at)
activity_logs(id, user_id→users, action, entity_type, entity_id,
              description, metadata JSON, ip_address, created_at)
```

---

## How the AI Search Works

1. **Upload** — Admin uploads a `.txt` or `.pdf` document.
2. **Chunk** — Text is split into 300-word overlapping chunks (50-word overlap).
3. **Embed** — Each chunk is encoded by `all-MiniLM-L6-v2` into a 384-dim vector, then L2-normalised.
4. **Index** — Vectors are added to a **FAISS IndexFlatIP** (inner product ≈ cosine similarity after normalisation) and persisted to disk.
5. **Search** — User query is embedded the same way; FAISS returns top-k chunks by cosine similarity with scores in `[0, 1]`.

> No external LLM API is required. The entire pipeline runs locally.

---

## Setup

### Option A — Docker (recommended, one command)

```bash
git clone <repo-url>
cd ai-task-manager
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000
- Swagger docs → http://localhost:8000/docs

Default admin credentials (seeded automatically):
```
Email:    admin@example.com
Password: Admin@123
```

---

### Option B — Local Development

#### Prerequisites
- Python 3.11+
- Node.js 20+
- MySQL 8.0 running locally

#### Backend

```bash
cd backend

# Create virtualenv
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL to your MySQL instance

# Start server (DB tables + seed data created automatically on first run)
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev       # → http://localhost:3000
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | — | Login, returns JWT |
| `POST` | `/api/v1/auth/register` | — | Self-register as user |
| `GET` | `/api/v1/auth/me` | Any | Current user info |
| `GET` | `/api/v1/tasks` | Any | List tasks (filterable: `?status=pending&priority=high&assigned_to=1`) |
| `POST` | `/api/v1/tasks` | Admin | Create task |
| `PATCH` | `/api/v1/tasks/{id}` | Any* | Update task fields |
| `PATCH` | `/api/v1/tasks/{id}/status` | Any* | Update status only |
| `DELETE` | `/api/v1/tasks/{id}` | Admin | Delete task |
| `POST` | `/api/v1/documents` | Admin | Upload + index document |
| `GET` | `/api/v1/documents` | Any | List all documents |
| `DELETE` | `/api/v1/documents/{id}` | Admin | Delete + remove from index |
| `POST` | `/api/v1/search` | Any | Semantic search query |
| `GET` | `/api/v1/analytics` | Any | System-wide analytics |
| `GET` | `/api/v1/users` | Admin | List users |
| `POST` | `/api/v1/users` | Admin | Create user |
| `DELETE` | `/api/v1/users/{id}` | Admin | Deactivate user |

\* Users can only modify tasks assigned to them, and only the `status` field.

---

## RBAC Summary

| Feature | Admin | User |
|---------|-------|------|
| Create / delete tasks | ✅ | ❌ |
| Update any task | ✅ | ❌ |
| Update own task status | ✅ | ✅ |
| Upload / delete documents | ✅ | ❌ |
| View documents | ✅ | ✅ |
| Semantic search | ✅ | ✅ |
| Manage users | ✅ | ❌ |
| View analytics | ✅ | ✅ |

---

## Project Structure

```
ai-task-manager/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # auth, tasks, documents, search, analytics, users
│   │   ├── core/               # config, security (JWT + bcrypt)
│   │   ├── db/                 # session, init_db (seed)
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # embedding_service, activity_service
│   │   └── main.py             # FastAPI app + lifespan
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/         # layout (Sidebar, AppLayout), auth (ProtectedRoute)
│   │   ├── pages/              # Dashboard, Tasks, Documents, Search, Analytics, Users
│   │   ├── services/           # axios instance with JWT interceptor
│   │   ├── store/              # Zustand auth store
│   │   └── types/              # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## Key Design Decisions

- **Singleton EmbeddingService** — model is loaded once at startup and kept in memory; FAISS index is persisted to disk so it survives restarts without re-indexing.
- **Overlapping chunking** — 50-word overlap prevents answers from being split across chunk boundaries.
- **L2 normalisation** — converting embeddings to unit vectors lets FAISS `IndexFlatIP` (inner product) behave as cosine similarity, which is the correct metric for sentence embeddings.
- **Activity logging middleware-free** — logs are written inline in service calls for simplicity; in production this would move to a background task queue.
- **RBAC in route layer** — `require_admin` / `get_current_user` FastAPI dependencies enforce roles at the API boundary, not the business logic layer, making it easy to audit.

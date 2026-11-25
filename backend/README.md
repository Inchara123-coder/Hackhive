# SmartSLA backend

The backend runs independently from the Next.js frontend. Express serves REST
and Socket.IO on port 5000; FastAPI serves complaint analysis on port 8000.

## Requirements and setup

Requires Node.js 20.9+, PostgreSQL 15+, and Python 3.10+.

From the project root, start the development database if Docker is available:

```powershell
docker compose up -d db
```

In this directory:

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The Prisma schema, initial migration, table catalog, and ER diagram are
documented in [`prisma/README.md`](./prisma/README.md). The development
migration creates the `smartsla_db` schema and applies database-level checks;
the seed data is synthetic.

Set `JWT_SECRET` to a random secret of at least 32 characters before exposing
the service. The example database credentials and seed password are for local
development only.

In `ai-service/`, create and activate a Python virtual environment, then run:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Run the frontend from `../frontend/`. Its `.env.local` should contain
`NEXT_PUBLIC_API_URL=http://localhost:5000/api`.

## Seeded accounts

The seed creates synthetic accounts only. The password is configured by
`DEMO_SEED_PASSWORD` in `backend/.env` (default: `SmartSLA123!`).

| Role | Email |
| --- | --- |
| Admin | `admin@smartsla.demo` |
| Agents | `agent1@smartsla.demo` through `agent5@smartsla.demo` |
| Customers | `customer1@smartsla.demo` through `customer10@smartsla.demo` |

Use the default password only on a local hackathon instance. The seed includes
30 synthetic complaints, approved troubleshooting entries, SLA policies,
messages, notes, assignments, and feedback. Running the seed again will not
recreate existing sample tickets.

## API routes

All REST routes are under `/api`. The `/health` endpoint is unauthenticated.

| Area | Routes |
| --- | --- |
| Auth/profile | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `PATCH /auth/me` |
| Complaints | `GET/POST /tickets`, `GET /tickets/:publicId`, `GET /tickets/:publicId/history`, `PATCH /tickets/:publicId` (self-service edits), `PATCH /tickets/:publicId/status`, `PATCH /tickets/:publicId/priority`, `GET /tickets/:publicId/assignment-recommendations`, `POST /tickets/:publicId/assignment` |
| Assignment queue | `GET /assignments`, `POST /assignments` |
| Self-service | `POST /ai/analyze`, `POST /tickets/:publicId/solution-feedback` |
| Messages | `GET/POST /tickets/:publicId/messages`, `GET/POST /tickets/:publicId/internal-notes` |
| Attachments | `POST /tickets/:publicId/attachments`, `GET /tickets/:publicId/attachments/:attachmentId` |
| People | `GET/POST /agents`, `PATCH /agents/:id`, `GET /customers`, `PATCH /users/:id/status` |
| Knowledge/templates | CRUD `/knowledge-base`, CRUD `/templates` |
| SLA/rescue | `GET /sla/policy`, `PUT /sla/policy/:priority`, `GET /sla/rescue`, `POST /sla/rescue/:publicId/confirm`, `GET/POST /escalations` |
| Notifications/reports | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `GET /analytics`, `GET /feedback` |
| Applications | `GET /applications` |

Authentication uses an HttpOnly, SameSite=Lax cookie. API clients may instead
send a bearer token. Socket.IO authenticates the same cookie or a token in the
handshake `auth.token` field. Clients must join ticket rooms using
`ticket:join` and only receive public messages; private notes are sent only to
staff user rooms.

## AI behavior

The FastAPI process trains TF-IDF/Logistic Regression category and priority
classifiers from the small synthetic dataset at startup. VADER supplies
sentiment and TF-IDF cosine similarity finds possible duplicate tickets.
`python evaluate.py` prints held-out synthetic evaluation reports; no accuracy
is asserted in the UI or documentation. Duplicate results are advisory and
never merge or delete complaints. If analysis is unavailable, ticket creation
returns a clear 503 and does not save a partially analyzed complaint.

Troubleshooting entries must be admin-approved before they can be returned to
customers. Guidance never claims to access an external app, issue a refund, or
change an account.

## SLA behavior

Server cron evaluates first-response and resolution deadlines every minute.
Warnings and breaches are recorded once, persisted as escalations, and
delivered as notifications. A deadline expiring never marks a ticket resolved.
SLA Rescue Mode only proposes actions; assignment changes require an admin
confirmation request.

## Development checks

```powershell
npm run typecheck
npm run build
npm test
```

The database-backed workflow requires a reachable PostgreSQL instance and a
running FastAPI service. A local environment without those services can still
type-check and build the Node service but cannot run migrations or complete
end-to-end API tests.

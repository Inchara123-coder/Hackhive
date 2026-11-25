# SmartSLA

SmartSLA is a hackathon prototype with independent frontend, API, and AI services.
The existing Next.js application is in `frontend/`; Express/TypeScript API code is
in `backend/`; the FastAPI model service is in `backend/ai-service/`.

## Requirements

- Node.js 20.9 or newer
- PostgreSQL 15 or newer
- Python 3.10 or newer

## Start the services

1. Start PostgreSQL with `docker compose up -d db` or use an existing server.
2. Copy `backend/.env.example` to `backend/.env`, set a strong `JWT_SECRET`, and
   set `DATABASE_URL` to your PostgreSQL database.
3. In `backend/`, run `npm install`, `npm run db:generate`,
   `npm run db:migrate`, and `npm run db:seed`.
4. In `backend/ai-service/`, create a virtual environment, install
   `requirements.txt`, and run `uvicorn main:app --reload --port 8000`.
5. In `backend/`, run `npm run dev`.
6. In `frontend/`, copy `.env.example` to `.env.local`, run `npm install`, and
   run `npm run dev`.

The PostgreSQL schema, initial migration, ER diagram, and table relationships
are documented in [`backend/prisma/README.md`](./backend/prisma/README.md).

The API listens on port 5000, the AI service on port 8000, and Next.js on port
3000. Use the seeded demo accounts documented in `backend/README.md`.

## Important

The complaint workflow concerns third-party apps only. It does not access those
apps, issue refunds, or perform account changes. Troubleshooting content is
guidance; customers should contact the app provider or bank through official
channels for account-specific support.

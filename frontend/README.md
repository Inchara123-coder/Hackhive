<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:6ea4244935e15a5fc14d2c19a32aeac5df31cb9c66be18be41a8581ee60073ef -->

# RelayDesk frontend

RelayDesk's backend-powered workspace is at **/** and **/smart-sla**. The
original browser-only demo is available at **/demo**; **/login** redirects
there. The two experiences use separate data stores.

## Install and run

Requires Node.js 20.9+ and npm. From `frontend/`:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000/** for the API/database-backed app. Use
`http://localhost:3000/demo` for the local-only demo preview. Use
`npm run typecheck` for TypeScript validation. To serve a production build,
run `npm run build` and then `npm start`.

## Demo sign in

The three role buttons on the local demo sign-in page fill the same role as the accounts below.

| Role | Email | Shared demo password |
| --- | --- | --- |
| Admin | admin@relaydesk.demo | RelayDesk123! |
| Agent | agent@relaydesk.demo | RelayDesk123! |
| Customer | customer@relaydesk.demo | RelayDesk123! |

New demo customer profiles and agents can sign in with their own email and the same shared password on that browser. These accounts belong to the local-only demo. Remember me controls where that demo stores its session. The live RelayDesk workspace uses the seeded backend accounts documented in
`../backend/README.md`. Default password: `SmartSLA123!` unless
`DEMO_SEED_PASSWORD` was changed in `backend/.env`.

## Workspaces

| Role | Routes after the role prefix |
| --- | --- |
| Customer | dashboard, create-ticket, tickets, tickets/:id, notifications, profile |
| Admin | dashboard, tickets, tickets/:id, agents, customers, sla-monitoring, sla-rescue, analytics, settings |
| Agent | dashboard, tickets, tickets/:id, notes, canned-responses, notifications, profile |

- **Customer:** Submit and follow tickets, attach filenames, review ticket history, reply to support, receive in-app notifications, and rate resolved tickets.
- **Admin:** Review ticket volumes, service levels and team performance; manage agents and customers; assign tickets; review SLA warnings and escalations; and configure resolution targets.
- **Agent:** Review assigned work, respond using templates, add private notes, update status, and resolve tickets. Private notes are omitted from the customer interface.
- **Shared:** Responsive navigation, ticket search and filters, sorting, pagination, live countdowns, dialogs, toasts, and charts that respond to range changes and hover or keyboard interaction.
- **Local-only demo:** The original RelayDesk role workspaces still use synthetic data and browser storage. Their simulated data is separate from the API.
- **Connected workspace:** The `/` and `/smart-sla` routes use the backend API for authentication, complaint submission, AI suggestions, ticket assignment, messaging, attachments, SLA status, feedback, and admin metrics.

## Folder structure

```text
helpdesk-system/
├── frontend/       # This Next.js app
├── backend/        # Express API, Prisma schema, and FastAPI AI service
├── docker-compose.yml
└── README.md
```

For backend setup, endpoints, and seeded credentials, see `../backend/README.md`.


<!-- /coderabbit-ai-generated:v1 -->
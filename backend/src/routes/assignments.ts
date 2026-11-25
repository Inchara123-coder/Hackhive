import { Router } from "express";
import { z } from "zod";
import { TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { allowRoles, requireAuth } from "../middleware/auth";
import { assignManually } from "../services/assignment";

export const assignmentsRouter = Router();
assignmentsRouter.use(requireAuth, allowRoles("ADMIN"));

assignmentsRouter.get("/", async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: {
      assignedAgentId: null,
      status: {
        in: [
          TicketStatus.OPEN,
          TicketStatus.PENDING,
          TicketStatus.WAITING_FOR_CUSTOMER,
        ],
      },
    },
    include: {
      application: { select: { name: true } },
      customer: { select: { name: true } },
      sla: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2 } as const;
  tickets.sort(
    (a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  res.json({
    tickets: tickets.map(({ application, ...ticket }) => ({
      ...ticket,
      application: application.name,
    })),
  });
});

assignmentsRouter.post("/", async (req, res) => {
  const input = z
    .object({ publicId: z.string().min(1).max(24), agentId: z.uuid() })
    .parse(req.body);
  const ticket = await prisma.ticket.findUnique({
    where: { publicId: input.publicId },
    select: { id: true },
  });
  if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
  const assignment = await assignManually(ticket.id, input.agentId, req.user!.id);
  res.status(201).json({ assignment });
});

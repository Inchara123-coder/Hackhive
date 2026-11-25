import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { allowRoles, requireAuth } from "../middleware/auth";
import { HttpError } from "../lib/http-error";
import { notifyAdmins, notifyUser } from "../services/notifications";
import { routeParam } from "../lib/route-param";

export const escalationsRouter = Router();
escalationsRouter.use(requireAuth, allowRoles("ADMIN"));
escalationsRouter.get("/", async (_req, res) => {
  const escalations = await prisma.escalation.findMany({
    include: {
      ticket: { select: { publicId: true, subject: true, priority: true, status: true } },
      actor: { select: { id: true, name: true } },
      notifiedAdmin: { select: { id: true, name: true } },
    },
    orderBy: { triggeredAt: "desc" },
    take: 100,
  });
  res.json({ escalations });
});
escalationsRouter.post("/:publicId", async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const ticket = await prisma.ticket.findUnique({
    where: { publicId: routeParam(req, "publicId") },
    select: { id: true, publicId: true, assignedAgentId: true },
  });
  if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
  const escalation = await prisma.escalation.create({
    data: {
      ticketId: ticket.id,
      actorId: req.user!.id,
      notifiedAdminId: req.user!.id,
      type: "MANUAL",
      level: 1,
      reason: input.reason,
    },
  });
  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      actorId: req.user!.id,
      actionType: "ESCALATION",
      event: "Admin manually escalated ticket",
      description: input.reason,
    },
  });
  const message = `${ticket.publicId} was escalated by an admin.`;
  await notifyAdmins("ESCALATION", message, ticket.id);
  if (ticket.assignedAgentId)
    await notifyUser(ticket.assignedAgentId, "ESCALATION", message, ticket.id);
  res.status(201).json({ escalation });
});

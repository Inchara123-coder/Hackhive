import { Router } from "express";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { allowRoles, requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { slaPolicySchema } from "../validators/schemas";
import { assignAutomatically, assignManually } from "../services/assignment";
import { notifyAdmins, notifyUser } from "../services/notifications";
import { routeParam } from "../lib/route-param";

export const slaRouter = Router();
slaRouter.use(requireAuth);

slaRouter.get("/policy", async (_req, res) => {
  const policies = await prisma.sLAPolicy.findMany({
    orderBy: { priority: "asc" },
  });
  res.json({ policies });
});

slaRouter.get("/watchlist", allowRoles("ADMIN"), async (_req, res) => {
  const now = new Date();
  const records = await prisma.sLARecord.findMany({
    where: {
      OR: [
        { state: { in: ["WARNING", "BREACHED"] } },
        { state: "ON_TRACK", resolutionDue: { lte: new Date(now.getTime() + 60 * 60 * 1000) } },
        {
          state: "ON_TRACK",
          firstResponseAt: null,
          firstResponseDue: { lte: new Date(now.getTime() + 60 * 60 * 1000) },
        },
      ],
    },
    include: {
      ticket: {
        select: {
          publicId: true,
          subject: true,
          priority: true,
          status: true,
          assignedAgent: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ state: "desc" }, { resolutionDue: "asc" }],
  });
  res.json({ records });
});

slaRouter.put(
  "/policy/:priority",
  allowRoles("ADMIN"),
  validateBody(slaPolicySchema),
  async (req, res) => {
    const priority = z.nativeEnum(TicketPriority).parse(routeParam(req, "priority"));
    const policy = await prisma.sLAPolicy.upsert({
      where: { priority },
      create: { priority, ...req.body },
      update: req.body,
    });
    res.json({ policy });
  },
);

slaRouter.get("/rescue", allowRoles("ADMIN"), async (_req, res) => {
  const now = new Date();
  const [tickets, profiles] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      include: {
        sla: true,
        customer: { select: { name: true } },
        assignedAgent: {
          select: {
            id: true,
            name: true,
            agentProfile: { select: { capacity: true } },
            _count: {
              select: {
                assignedTickets: {
                  where: {
                    status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.agentProfile.findMany({
      where: { user: { active: true, role: "AGENT" } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                assignedTickets: {
                  where: {
                    status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  const recommendations = tickets.flatMap((ticket) => {
    const due = ticket.sla?.resolutionDue;
    const overdue = due ? due.getTime() <= now.getTime() : false;
    const nearDeadline = due
      ? due.getTime() - now.getTime() <= 60 * 60 * 1000
      : false;
    const assignedAgent = ticket.assignedAgent;
    const overloaded = Boolean(
      assignedAgent?.agentProfile &&
        assignedAgent._count.assignedTickets >= assignedAgent.agentProfile.capacity,
    );
    const firstResponseAt = ticket.sla?.firstResponseAt;
    const firstResponseDue = ticket.sla?.firstResponseDue;
    const responseAtRisk =
      !firstResponseAt &&
      firstResponseDue !== undefined &&
      firstResponseDue.getTime() - now.getTime() <= 60 * 60 * 1000;
    const items: {
      publicId: string;
      ticketId: string;
      priority: TicketPriority;
      reason: string;
      recommendedAction: string;
      suggestedAgentId?: string;
    }[] = [];
    if (!ticket.assignedAgentId && ticket.priority === "URGENT")
      items.push({
        publicId: ticket.publicId,
        ticketId: ticket.id,
        priority: ticket.priority,
        reason: "Urgent complaint is unassigned.",
        recommendedAction: "Assign to an available agent.",
      });
    if (overdue || nearDeadline)
      items.push({
        publicId: ticket.publicId,
        ticketId: ticket.id,
        priority: ticket.priority,
        reason: overdue ? "Resolution SLA has been breached." : "Resolution deadline is within one hour.",
        recommendedAction: "Escalate and review ownership.",
      });
    if (responseAtRisk)
      items.push({
        publicId: ticket.publicId,
        ticketId: ticket.id,
        priority: ticket.priority,
        reason: "The ticket has not received a first response and its response deadline is near or overdue.",
        recommendedAction: "Notify the assigned agent or assign an available agent.",
      });
    if (overloaded && assignedAgent && ticket.assignedAgentId) {
      const alternative = profiles.find(
        (profile) =>
          profile.userId !== ticket.assignedAgentId &&
          profile.skills.includes(ticket.category) &&
          profile.availability === "AVAILABLE" &&
          profile.user._count.assignedTickets < profile.capacity,
      );
      if (alternative)
        items.push({
          publicId: ticket.publicId,
          ticketId: ticket.id,
          priority: ticket.priority,
          reason: `${assignedAgent.name} is at or above ticket capacity.`,
          recommendedAction: "Reassign to an available agent.",
          suggestedAgentId: alternative.userId,
        });
    }
    return items;
  });
  res.json({ recommendations });
});

slaRouter.post(
  "/rescue/:publicId/confirm",
  allowRoles("ADMIN"),
  async (req, res) => {
    const input = z
      .object({
        action: z.enum(["assign", "automatic", "escalate"]),
        agentId: z.uuid().optional(),
      })
      .parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { publicId: routeParam(req, "publicId") },
      select: { id: true, publicId: true, assignedAgentId: true },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
    if (input.action === "assign") {
      if (!input.agentId) throw new HttpError(400, "Choose an agent.", "AGENT_REQUIRED");
      const assigned = await assignManually(ticket.id, input.agentId, req.user!.id);
      res.json({ action: "assigned", assignment: assigned });
      return;
    }
    if (input.action === "automatic") {
      const assigned = await assignAutomatically(ticket.id, req.user!.id, true);
      res.json({ action: assigned ? "assigned" : "unassigned", assignment: assigned ?? null });
      return;
    }
    const escalation = await prisma.escalation.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user!.id,
        notifiedAdminId: req.user!.id,
        type: "MANUAL",
        level: 1,
        reason: "Admin confirmed manual SLA rescue escalation.",
        actionTaken: "Manual SLA rescue escalation confirmed.",
      },
    });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user!.id,
        actionType: "ESCALATION",
        event: "Admin confirmed SLA rescue escalation",
        description: escalation.reason,
      },
    });
    const message = `Admin escalated ${ticket.publicId} for SLA rescue.`;
    await notifyAdmins("ESCALATION", message, ticket.id);
    if (ticket.assignedAgentId)
      await notifyUser(ticket.assignedAgentId, "ESCALATION", message, ticket.id);
    res.json({ action: "escalated", publicId: ticket.publicId });
  },
);


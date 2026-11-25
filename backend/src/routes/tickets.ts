import { Router } from "express";
import {
  ComplaintCategory,
  SlaState,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { newPublicId } from "../lib/public-id";
import { routeParam } from "../lib/route-param";
import { requireAuth, allowRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  assignmentSchema,
  feedbackSchema,
  solutionFeedbackSchema,
  ticketCreateSchema,
  ticketListQuerySchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketUpdateSchema,
} from "../validators/schemas";
import { analyzeComplaint } from "../services/ai-client";
import { findSolution } from "../services/knowledge";
import { assignAutomatically, assignManually } from "../services/assignment";
import { completeSla, createSlaRecord } from "../services/sla";
import { notifyAdmins, notifyUser } from "../services/notifications";
import { accessibleTicket, publicTicketView } from "../services/ticket-access";
import { recordSolutionFeedback } from "../services/solution-feedback";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

function isStaff(role: string) {
  return role === "ADMIN" || role === "AGENT";
}

ticketsRouter.post(
  "/",
  allowRoles("CUSTOMER"),
  validateBody(ticketCreateSchema),
  async (req, res) => {
    const input = req.body as {
      application: string;
      subject: string;
      description: string;
      category?: ComplaintCategory;
    };
    const application = await prisma.application.findFirst({
      where: { name: input.application, active: true },
      select: { id: true },
    });
    if (!application)
      throw new HttpError(400, "Choose an active application.", "INVALID_APPLICATION");
    const recent = await prisma.ticket.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { publicId: true, subject: true, description: true },
    });
    const analysis = await analyzeComplaint({
      ...input,
      existing: recent.map((ticket) => ({
        id: ticket.publicId,
        subject: ticket.subject,
        description: ticket.description,
      })),
    });
    const category =
      analysis.categoryConfidence >= 0.35
        ? analysis.category
        : input.category ?? ComplaintCategory.OTHER;
    const priority = analysis.priority ?? TicketPriority.NORMAL;
    const solution = await findSolution({
      application: input.application,
      category,
      subject: input.subject,
      description: input.description,
    });
    const publicId = newPublicId();
    const createdAt = new Date();
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          publicId,
          applicationId: application.id,
          subject: input.subject,
          description: input.description,
          category,
          priority,
          priorityConfidence: analysis.priorityConfidence,
          priorityReason: analysis.priorityReason,
          status: solution ? TicketStatus.SELF_SERVICE : TicketStatus.OPEN,
          customerId: req.user!.id,
          createdAt,
          analyses: {
            create: {
              confidenceScore:
                (analysis.categoryConfidence + analysis.priorityConfidence) / 2,
              analysisReason: analysis.priorityReason,
              duplicateDetected: analysis.duplicates.length > 0,
              predictedCategory: analysis.category,
              categoryConfidence: analysis.categoryConfidence,
              predictedPriority: analysis.priority,
              priorityConfidence: analysis.priorityConfidence,
              sentiment: analysis.sentiment,
              sentimentScore: analysis.sentimentScore,
              priorityReason: analysis.priorityReason,
              duplicateTicketIds: analysis.duplicates.map((item) => item.ticketId),
              modelVersion: analysis.modelVersion,
            },
          },
          history: {
            create: {
              event: "Complaint submitted",
              details: { application: input.application },
            },
          },
        },
      });
      await createSlaRecord(tx, created.id, priority, createdAt);
      if (solution) {
        await tx.aISuggestion.create({
          data: {
            ticketId: created.id,
            knowledgeBaseId: solution.entry.id,
            relevance: solution.relevance,
            steps: solution.entry.troubleshooting,
            recommended: solution.entry.recommended,
          },
        });
      }
      return created;
    });

    await notifyUser(
      req.user!.id,
      "TICKET_CREATED",
      `Complaint ${ticket.publicId} was created.`,
      ticket.id,
    );
    if (solution) {
      await notifyUser(
        req.user!.id,
        "AI_SOLUTION",
        `Troubleshooting suggestions are ready for ${ticket.publicId}.`,
        ticket.id,
      );
    } else {
      await assignAutomatically(ticket.id);
    }

    const result = await accessibleTicket(ticket.publicId, req);
    res.status(201).json({ ticket: publicTicketView(result, false) });
  },
);

ticketsRouter.get("/", async (req, res) => {
  const { page, limit, search, status, priority, category } =
    ticketListQuerySchema.parse(req.query);
  const where: Prisma.TicketWhereInput = {
    ...(req.user!.role === "CUSTOMER"
      ? { customerId: req.user!.id }
      : req.user!.role === "AGENT"
        ? { assignedAgentId: req.user!.id }
        : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { publicId: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
          { application: { is: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, tickets] = await prisma.$transaction([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true } },
        application: { select: { name: true } },
        sla: true,
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        suggestions: { orderBy: { relevance: "desc" } },
        feedback: true,
      },
    }),
  ]);
  res.json({
    tickets: tickets.map(({ application, analyses, ...ticket }) => ({
      ...ticket,
      application: application.name,
      analysis: analyses[0] ?? null,
    })),
    page,
    limit,
    total,
  });
});

ticketsRouter.get("/:publicId", async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  res.json({ ticket: publicTicketView(ticket, isStaff(req.user!.role)) });
});

ticketsRouter.get("/:publicId/history", async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  const history = isStaff(req.user!.role)
    ? ticket.history
    : ticket.history
        .filter((event) => event.isPublic)
        .map(({ details: _details, isPublic: _isPublic, ...event }) => event);
  res.json({ history });
});

ticketsRouter.get(
  "/:publicId/assignment-recommendations",
  allowRoles("ADMIN"),
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { publicId: routeParam(req, "publicId") },
      select: { category: true, priority: true },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
    const profiles = await prisma.agentProfile.findMany({
      where: {
        availability: "AVAILABLE",
        skills: { has: ticket.category },
        user: { active: true, role: "AGENT" },
      },
      include: { user: { select: { id: true, name: true } } },
    });
    const counts = await prisma.ticket.groupBy({
      by: ["assignedAgentId"],
      where: {
        assignedAgentId: { in: profiles.map((profile) => profile.userId) },
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      _count: { _all: true },
    });
    const workload = new Map(
      counts.map((item) => [item.assignedAgentId, item._count._all]),
    );
    const recommendations = profiles
      .map((profile) => ({
        agentId: profile.user.id,
        name: profile.user.name,
        workload: workload.get(profile.userId) ?? 0,
        capacity: profile.capacity,
      }))
      .filter((agent) => agent.workload < agent.capacity)
      .sort((a, b) =>
        ticket.priority === "URGENT"
          ? a.workload - b.workload
          : a.workload / a.capacity - b.workload / b.capacity,
      );
    res.json({ recommendations });
  },
);

ticketsRouter.patch(
  "/:publicId",
  allowRoles("CUSTOMER"),
  validateBody(ticketUpdateSchema),
  async (req, res) => {
    const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
    if (ticket.status !== TicketStatus.SELF_SERVICE || ticket.assignedAgentId)
      throw new HttpError(409, "A complaint can only be edited while awaiting the self-service response.", "TICKET_NOT_EDITABLE");
    const input = req.body as {
      application?: string;
      subject?: string;
      description?: string;
      category?: ComplaintCategory;
    };
    const applicationName = input.application ?? ticket.application.name;
    const application = await prisma.application.findFirst({
      where: { name: applicationName, active: true },
      select: { id: true },
    });
    if (!application)
      throw new HttpError(400, "Choose an active application.", "INVALID_APPLICATION");
    const updatedFields = {
      application: applicationName,
      subject: input.subject ?? ticket.subject,
      description: input.description ?? ticket.description,
    };
    const recent = await prisma.ticket.findMany({
      where: {
        status: { notIn: ["RESOLVED", "CLOSED"] },
        id: { not: ticket.id },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { publicId: true, subject: true, description: true },
    });
    const analysis = await analyzeComplaint({
      ...updatedFields,
      existing: recent.map((item) => ({
        id: item.publicId,
        subject: item.subject,
        description: item.description,
      })),
    });
    const category =
      analysis.categoryConfidence >= 0.35
        ? analysis.category
        : input.category ?? ticket.category;
    const solution = await findSolution({ ...updatedFields, category });
    await prisma.$transaction(async (tx) => {
      const policy = await tx.sLAPolicy.findUnique({
        where: { priority: analysis.priority },
      });
      if (!policy?.active)
        throw new HttpError(503, `No active SLA policy is configured for ${analysis.priority}.`, "SLA_POLICY_MISSING");
      const update = await tx.ticket.updateMany({
        where: {
          id: ticket.id,
          status: TicketStatus.SELF_SERVICE,
          assignedAgentId: null,
          updatedAt: ticket.updatedAt,
        },
        data: {
          applicationId: application.id,
          subject: updatedFields.subject,
          description: updatedFields.description,
          category,
          priority: analysis.priority,
          priorityConfidence: analysis.priorityConfidence,
          priorityReason: analysis.priorityReason,
          status: solution ? TicketStatus.SELF_SERVICE : TicketStatus.OPEN,
        },
      });
      if (!update.count)
        throw new HttpError(409, "The complaint changed while you were editing it. Reload and try again.", "TICKET_CHANGED");
      const currentSla = await tx.sLARecord.findUnique({
        where: { ticketId: ticket.id },
        select: { id: true, breachedAt: true },
      });
      if (currentSla) {
        await tx.sLARecord.update({
          where: { id: currentSla.id },
          data: {
            policyId: policy.id,
            firstResponseDue: new Date(
              ticket.createdAt.getTime() + policy.firstResponseMins * 60_000,
            ),
            resolutionDue: new Date(
              ticket.createdAt.getTime() + policy.resolutionMins * 60_000,
            ),
            warningAt: null,
            state: currentSla.breachedAt ? SlaState.BREACHED : SlaState.ON_TRACK,
            responseSlaStatus: currentSla.breachedAt
              ? SlaState.BREACHED
              : SlaState.ON_TRACK,
            resolutionSlaStatus: currentSla.breachedAt
              ? SlaState.BREACHED
              : SlaState.ON_TRACK,
          },
        });
      }
      await tx.aIAnalysis.create({
        data: {
          ticketId: ticket.id,
          confidenceScore:
            (analysis.categoryConfidence + analysis.priorityConfidence) / 2,
          analysisReason: analysis.priorityReason,
          duplicateDetected: analysis.duplicates.length > 0,
          predictedCategory: analysis.category,
          categoryConfidence: analysis.categoryConfidence,
          predictedPriority: analysis.priority,
          priorityConfidence: analysis.priorityConfidence,
          sentiment: analysis.sentiment,
          sentimentScore: analysis.sentimentScore,
          priorityReason: analysis.priorityReason,
          duplicateTicketIds: analysis.duplicates.map((item) => item.ticketId),
          modelVersion: analysis.modelVersion,
        },
      });
      await tx.aISuggestion.deleteMany({ where: { ticketId: ticket.id } });
      if (solution)
        await tx.aISuggestion.create({
          data: {
            ticketId: ticket.id,
            knowledgeBaseId: solution.entry.id,
            relevance: solution.relevance,
            steps: solution.entry.troubleshooting,
            recommended: solution.entry.recommended,
          },
        });
      await tx.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user!.id,
          event: "Customer updated complaint details",
        },
      });
    });
    if (!solution) await assignAutomatically(ticket.id);
    const updated = await accessibleTicket(ticket.publicId, req);
    res.json({ ticket: publicTicketView(updated, false) });
  },
);

ticketsRouter.post(
  "/:publicId/solution-feedback",
  allowRoles("CUSTOMER"),
  validateBody(solutionFeedbackSchema),
  async (req, res) => {
    const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
    const { resolved } = req.body as { resolved: boolean };
    await recordSolutionFeedback(ticket, req.user!.id, resolved);
    const updated = await accessibleTicket(ticket.publicId, req);
    res.json({ ticket: publicTicketView(updated, false) });
  },
);

ticketsRouter.patch(
  "/:publicId/priority",
  allowRoles("ADMIN"),
  validateBody(ticketPrioritySchema),
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { publicId: routeParam(req, "publicId") },
      select: {
        id: true,
        status: true,
        priority: true,
        customerId: true,
        assignedAgentId: true,
      },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
    if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)
      throw new HttpError(409, "Resolved tickets cannot be reprioritized.", "TICKET_RESOLVED");
    const input = req.body as { priority: TicketPriority; reason: string };
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        priority: input.priority,
        priorityReason: `Admin override: ${input.reason}`,
      },
    });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user!.id,
        actionType: "PRIORITY_CHANGE",
        event: `Priority changed to ${input.priority}`,
        oldValue: { priority: ticket.priority },
        newValue: { priority: input.priority },
        details: { reason: input.reason },
        description: input.reason,
      },
    });
    await notifyUser(
      ticket.customerId,
      "ADMIN_ACTION",
      `The priority of ${updated.publicId} was updated.`,
      ticket.id,
    );
    if (ticket.assignedAgentId)
      await notifyUser(
        ticket.assignedAgentId,
        "ADMIN_ACTION",
        `The priority of ${updated.publicId} was updated.`,
        ticket.id,
      );
    const detailed = await accessibleTicket(updated.publicId, req);
    res.json({ ticket: publicTicketView(detailed, true) });
  },
);

ticketsRouter.patch(
  "/:publicId/status",
  allowRoles("ADMIN", "AGENT"),
  validateBody(ticketStatusSchema),
  async (req, res) => {
    const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
    if (req.user!.role === "AGENT" && ticket.assignedAgentId !== req.user!.id)
      throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
    const { status } = req.body as { status: TicketStatus };
    const at = new Date();
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status,
          resolvedAt:
            status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED
              ? at
              : null,
          closedAt: status === TicketStatus.CLOSED ? at : null,
        },
      }),
      prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user!.id,
          actionType: "STATUS_CHANGE",
          event: `Status changed to ${status.toLowerCase()}`,
          oldValue: { status: ticket.status },
          newValue: { status },
        },
      }),
    ]);
    const completed = status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED;
    if (completed) await completeSla(ticket.id, at);
    if (!completed) {
      await prisma.sLARecord.updateMany({
        where: { ticketId: ticket.id, state: SlaState.COMPLETED },
        data: {
          state: SlaState.ON_TRACK,
          responseSlaStatus: ticket.sla?.firstResponseAt
            ? SlaState.COMPLETED
            : SlaState.ON_TRACK,
          resolutionSlaStatus: SlaState.ON_TRACK,
          resolvedAt: null,
        },
      });
    }
    const isResolved = status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED;
    await notifyUser(
      ticket.customerId,
      isResolved ? "TICKET_RESOLVED" : "ADMIN_ACTION",
      isResolved
        ? `Complaint ${ticket.publicId} was ${status === TicketStatus.CLOSED ? "closed" : "resolved"}.`
        : `Complaint ${ticket.publicId} status changed to ${status.toLowerCase()}.`,
      ticket.id,
    );
    const updated = await accessibleTicket(ticket.publicId, req);
    res.json({ ticket: publicTicketView(updated, true) });
  },
);

ticketsRouter.post(
  "/:publicId/assignment",
  allowRoles("ADMIN"),
  validateBody(assignmentSchema),
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { publicId: routeParam(req, "publicId") },
      select: { id: true, customerId: true },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
    const assignment = await assignManually(
      ticket.id,
      (req.body as { agentId: string }).agentId,
      req.user!.id,
    );
    await notifyUser(
      ticket.customerId,
      "TICKET_ASSIGNED",
      `Complaint ${assignment.publicId} was assigned to ${assignment.agentName}.`,
      ticket.id,
    );
    res.json({ assignment });
  },
);

ticketsRouter.post(
  "/:publicId/feedback",
  allowRoles("CUSTOMER"),
  validateBody(feedbackSchema),
  async (req, res) => {
    const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
    if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED)
      throw new HttpError(409, "Feedback is available after resolution.", "TICKET_NOT_RESOLVED");
    const input = req.body as { rating: number; comment?: string };
    const feedback = await prisma.feedback.upsert({
      where: { ticketId: ticket.id },
      create: {
        ticketId: ticket.id,
        customerId: req.user!.id,
        rating: input.rating,
        comment: input.comment,
      },
      update: { rating: input.rating, comment: input.comment },
    });
    await notifyAdmins("FEEDBACK", `New customer feedback for ${ticket.publicId}.`, ticket.id);
    res.status(201).json({ feedback });
  },
);


import { AgentAvailability, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { notifyAdmins, notifyUser } from "./notifications";

export async function assignAutomatically(
  ticketId: string,
  actorId?: string,
  allowReassignment = false,
) {
  const assigned = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(618024)`;
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          publicId: true,
          category: true,
          priority: true,
          status: true,
          assignedAgentId: true,
        },
      });
      if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
      if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)
        throw new HttpError(409, "Resolved tickets cannot be assigned.", "TICKET_RESOLVED");
      if (ticket.assignedAgentId && !allowReassignment)
        throw new HttpError(409, "Ticket is already assigned.", "TICKET_ALREADY_ASSIGNED");

      const profiles = await tx.agentProfile.findMany({
        where: {
          availability: AgentAvailability.AVAILABLE,
          ...(ticket.assignedAgentId ? { userId: { not: ticket.assignedAgentId } } : {}),
          user: { active: true, role: "AGENT" },
          skills: { has: ticket.category },
        },
        include: { user: { select: { id: true, name: true } } },
      });
      if (!profiles.length) return undefined;
      const counts = await tx.ticket.groupBy({
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
      const ranked = profiles
        .map((profile) => ({
          profile,
          count: workload.get(profile.userId) ?? 0,
        }))
        .filter((item) => item.count < item.profile.capacity)
        .sort((a, b) => {
          if (ticket.priority === "URGENT") return a.count - b.count;
          return (
            a.count / a.profile.capacity - b.count / b.profile.capacity ||
            a.count - b.count
          );
        });
      const selected = ranked[0]?.profile;
      if (!selected) return undefined;

      if (ticket.assignedAgentId) {
        await tx.ticketAssignment.updateMany({
          where: {
            ticketId: ticket.id,
            agentId: ticket.assignedAgentId,
            unassignedAt: null,
          },
          data: { unassignedAt: new Date() },
        });
      }
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { assignedAgentId: selected.userId, status: TicketStatus.ASSIGNED },
      });
      await tx.ticketAssignment.create({
        data: {
          ticketId: ticket.id,
          agentId: selected.userId,
          assignedById: actorId,
          assignmentType: ticket.assignedAgentId ? "REASSIGNMENT" : "AUTOMATIC",
          assignmentReason: `Matched ${ticket.category} skill and current workload.`,
        },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorId,
          actionType: ticket.assignedAgentId ? "REASSIGNMENT" : "ASSIGNMENT",
          event: "Ticket automatically assigned",
          oldValue: ticket.assignedAgentId
            ? { agentId: ticket.assignedAgentId }
            : undefined,
          newValue: { agentId: selected.userId },
          details: { agentId: selected.userId },
        },
      });
      return {
        ticketId: ticket.id,
        publicId: ticket.publicId,
        agentId: selected.userId,
        agentName: selected.user.name,
      };
    },
  );
  if (!assigned) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { publicId: true },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
    await notifyAdmins(
      "ADMIN_ACTION",
      `No available agent matches the skills and capacity for ticket ${ticket.publicId}.`,
      ticketId,
    );
    return undefined;
  }
  await notifyUser(
    assigned.agentId,
    "TICKET_ASSIGNED",
    `Ticket ${assigned.publicId} was assigned to you.`,
    assigned.ticketId,
  );
  await notifyAdmins(
    "TICKET_ASSIGNED",
    `Ticket ${assigned.publicId} was assigned to ${assigned.agentName}.`,
    assigned.ticketId,
  );
  return assigned;
}

export async function assignManually(
  ticketId: string,
  agentId: string,
  adminId: string,
) {
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(618024)`;
      const [ticket, agent] = await Promise.all([
        tx.ticket.findUnique({ where: { id: ticketId } }),
        tx.agentProfile.findFirst({
          where: {
            userId: agentId,
            user: { active: true, role: "AGENT" },
          },
          include: { user: { select: { id: true, name: true } } },
        }),
      ]);
      if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
      if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)
        throw new HttpError(409, "Resolved tickets cannot be assigned.", "TICKET_RESOLVED");
      if (!agent) throw new HttpError(400, "Choose an active support agent.", "INVALID_AGENT");
      if (ticket.assignedAgentId) {
        await tx.ticketAssignment.updateMany({
          where: {
            ticketId,
            agentId: ticket.assignedAgentId,
            unassignedAt: null,
          },
          data: { unassignedAt: new Date() },
        });
      }
      await tx.ticket.update({
        where: { id: ticketId },
        data: { assignedAgentId: agentId, status: TicketStatus.ASSIGNED },
      });
      await tx.ticketAssignment.create({
        data: {
          ticketId,
          agentId,
          assignedById: adminId,
          assignmentType: ticket.assignedAgentId ? "REASSIGNMENT" : "MANUAL",
          assignmentReason: "Manual assignment confirmed by admin.",
        },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId,
          actorId: adminId,
          actionType: ticket.assignedAgentId ? "REASSIGNMENT" : "ASSIGNMENT",
          event: "Ticket manually assigned",
          oldValue: ticket.assignedAgentId
            ? { agentId: ticket.assignedAgentId }
            : undefined,
          newValue: { agentId },
          details: { agentId },
        },
      });
      return { id: ticket.id, publicId: ticket.publicId, agentName: agent.user.name };
    },
  );
  await notifyUser(
    agentId,
    "TICKET_ASSIGNED",
    `Ticket ${result.publicId} was assigned to you.`,
    result.id,
  );
  return result;
}


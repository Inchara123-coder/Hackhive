import { Prisma, SlaState, TicketPriority } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { notifyAdmins, notifyUser } from "./notifications";

async function recordBreach(
  input: {
    id: string;
    ticketId: string;
    publicId: string;
    assignedAgentId: string | null;
  },
  at: Date,
  reason: string,
  deadline: "RESPONSE" | "RESOLUTION" | "BOTH" = "BOTH",
) {
  const updated = await prisma.sLARecord.updateMany({
    where: {
      id: input.id,
      breachedAt: null,
      state: { not: SlaState.COMPLETED },
    },
    data: {
      breachedAt: at,
      state: SlaState.BREACHED,
      ...(deadline === "RESPONSE" || deadline === "BOTH"
        ? { responseSlaStatus: SlaState.BREACHED }
        : {}),
      ...(deadline === "RESOLUTION" || deadline === "BOTH"
        ? { resolutionSlaStatus: SlaState.BREACHED }
        : {}),
    },
  });
  if (!updated.count) return false;
  await prisma.escalation.create({
    data: {
      ticketId: input.ticketId,
      type: "BREACH",
      level: 1,
      reason,
      triggeredAt: at,
    },
  });
  await prisma.ticketHistory.create({
    data: {
      ticketId: input.ticketId,
      actionType: "SLA_BREACH",
      event: "SLA breached and escalated",
      details: { at: at.toISOString() },
      description: reason,
    },
  });
  const message = `${input.publicId} has breached its SLA.`;
  await notifyAdmins("SLA_BREACH", message, input.ticketId);
  if (input.assignedAgentId)
    await notifyUser(input.assignedAgentId, "SLA_BREACH", message, input.ticketId);
  return true;
}

export async function createSlaRecord(
  tx: Prisma.TransactionClient,
  ticketId: string,
  priority: TicketPriority,
  createdAt: Date,
) {
  const policy = await tx.sLAPolicy.findUnique({ where: { priority } });
  if (!policy?.active)
    throw new HttpError(503, `No active SLA policy is configured for ${priority}.`, "SLA_POLICY_MISSING");
  return tx.sLARecord.create({
    data: {
      ticketId,
      policyId: policy.id,
      firstResponseDue: new Date(createdAt.getTime() + policy.firstResponseMins * 60_000),
      resolutionDue: new Date(createdAt.getTime() + policy.resolutionMins * 60_000),
      state: SlaState.ON_TRACK,
    },
  });
}

export async function markFirstResponse(ticketId: string, at = new Date()) {
  const record = await prisma.sLARecord.findUnique({
    where: { ticketId },
    include: { ticket: { select: { id: true, publicId: true, assignedAgentId: true } } },
  });
  if (!record || record.firstResponseAt) return;
  if (at > record.firstResponseDue) {
    await recordBreach(
      { ...record, ticketId: record.ticket.id, publicId: record.ticket.publicId, assignedAgentId: record.ticket.assignedAgentId },
      at,
      `First response deadline passed for ${record.ticket.publicId}.`,
      "RESPONSE",
    );
    await prisma.sLARecord.updateMany({
      where: { id: record.id, firstResponseAt: null },
      data: {
        firstResponseAt: at,
        responseSlaStatus: SlaState.BREACHED,
      },
    });
    return;
  }
  await prisma.sLARecord.updateMany({
    where: { id: record.id, firstResponseAt: null },
    data: { firstResponseAt: at, responseSlaStatus: SlaState.COMPLETED },
  });
}

export async function completeSla(ticketId: string, at = new Date()) {
  const record = await prisma.sLARecord.findUnique({
    where: { ticketId },
    include: {
      ticket: {
        select: { id: true, publicId: true, assignedAgentId: true },
      },
    },
  });
  if (!record) return;
  const missedFirstResponse =
    !record.firstResponseAt && record.firstResponseDue < at;
  const missedResolution = record.resolutionDue < at;
  if (record.breachedAt || missedFirstResponse || missedResolution) {
    const deadline =
      missedFirstResponse && missedResolution
        ? "BOTH"
        : missedFirstResponse
          ? "RESPONSE"
          : "RESOLUTION";
    await recordBreach(
      { ...record, ticketId: record.ticket.id, publicId: record.ticket.publicId, assignedAgentId: record.ticket.assignedAgentId },
      at,
      missedFirstResponse
        ? `First response deadline passed for ${record.ticket.publicId}.`
        : `Resolution deadline passed for ${record.ticket.publicId}.`,
      deadline,
    );
    await prisma.sLARecord.updateMany({
      where: { id: record.id, resolvedAt: null },
      data: {
        resolvedAt: at,
        ...(!record.breachedAt && !missedResolution
          ? { resolutionSlaStatus: SlaState.COMPLETED }
          : {}),
        ...(!record.breachedAt && !missedFirstResponse
          ? { responseSlaStatus: SlaState.COMPLETED }
          : {}),
      },
    });
    return;
  }
  await prisma.sLARecord.updateMany({
    where: { id: record.id, state: { not: SlaState.BREACHED } },
    data: {
      resolvedAt: at,
      state: SlaState.COMPLETED,
      responseSlaStatus: SlaState.COMPLETED,
      resolutionSlaStatus: SlaState.COMPLETED,
    },
  });
}

export async function monitorSlaOnce(now = new Date()) {
  const records = await prisma.sLARecord.findMany({
    where: { state: { in: [SlaState.ON_TRACK, SlaState.WARNING] } },
    include: {
      policy: true,
      ticket: {
        select: {
          id: true,
          publicId: true,
          status: true,
          assignedAgentId: true,
        },
      },
    },
  });

  for (const record of records) {
    if (
      record.ticket.status === "RESOLVED" ||
      record.ticket.status === "CLOSED" ||
      record.state === "COMPLETED"
    )
      continue;
    const responseOverdue = !record.firstResponseAt && record.firstResponseDue <= now;
    const resolutionOverdue = record.resolutionDue <= now;
    if ((responseOverdue || resolutionOverdue) && !record.breachedAt) {
      await recordBreach(
        { ...record, ticketId: record.ticket.id, publicId: record.ticket.publicId, assignedAgentId: record.ticket.assignedAgentId },
        now,
        `A response or resolution deadline passed for ${record.ticket.publicId}.`,
        responseOverdue && resolutionOverdue
          ? "BOTH"
          : responseOverdue
            ? "RESPONSE"
            : "RESOLUTION",
      );
      continue;
    }
    const responseWarningDue =
      !record.firstResponseAt &&
      record.firstResponseDue.getTime() - now.getTime() <= record.policy.warningMins * 60_000;
    const resolutionWarningDue =
      record.resolutionDue.getTime() - now.getTime() <= record.policy.warningMins * 60_000;
    const warningDue = responseWarningDue || resolutionWarningDue;
    if (warningDue && !record.warningAt) {
      const result = await prisma.sLARecord.updateMany({
        where: { id: record.id, warningAt: null, breachedAt: null },
        data: {
          warningAt: now,
          state: SlaState.WARNING,
          ...(responseWarningDue ? { responseSlaStatus: SlaState.WARNING } : {}),
          ...(resolutionWarningDue ? { resolutionSlaStatus: SlaState.WARNING } : {}),
        },
      });
      if (!result.count) continue;
      await prisma.escalation.create({
        data: {
          ticketId: record.ticket.id,
          type: "WARNING",
          reason: `${record.ticket.publicId} is approaching an SLA deadline.`,
        },
      });
      const message = `${record.ticket.publicId} is approaching an SLA deadline.`;
      if (record.ticket.assignedAgentId)
        await notifyUser(record.ticket.assignedAgentId, "SLA_WARNING", message, record.ticket.id);
      await notifyAdmins("SLA_WARNING", message, record.ticket.id);
    }
  }
}

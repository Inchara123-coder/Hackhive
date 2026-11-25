import { Router } from "express";
import { TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { allowRoles, requireAuth } from "../middleware/auth";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, allowRoles("ADMIN"));

analyticsRouter.get("/", async (_req, res) => {
  const [
    total,
    open,
    pending,
    resolved,
    closed,
    selfService,
    breached,
    feedback,
    agentProfiles,
    categoryGroups,
    priorityGroups,
    responseRows,
    resolutionRows,
    ratingDistribution,
    agentCsat,
    slaTotal,
    slaMet,
  ] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({
      where: {
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
    }),
    prisma.ticket.count({ where: { status: TicketStatus.PENDING } }),
    prisma.ticket.count({ where: { status: TicketStatus.RESOLVED } }),
    prisma.ticket.count({ where: { status: TicketStatus.CLOSED } }),
    prisma.ticket.count({ where: { selfServiceResolved: true } }),
    prisma.sLARecord.count({ where: { breachedAt: { not: null } } }),
    prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.agentProfile.findMany({
      include: { user: { select: { id: true, name: true, active: true } } },
    }),
    prisma.ticket.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], _count: { _all: true } }),
    prisma.sLARecord.findMany({
      where: { firstResponseAt: { not: null } },
      select: { firstResponseAt: true, ticket: { select: { createdAt: true } } },
    }),
    prisma.sLARecord.findMany({
      where: { resolvedAt: { not: null } },
      select: { resolvedAt: true, ticket: { select: { createdAt: true } } },
    }),
    prisma.feedback.groupBy({ by: ["rating"], _count: { _all: true }, orderBy: { rating: "asc" } }),
    prisma.$queryRaw<{ agentId: string; averageRating: number; total: bigint }[]>`
      SELECT t."assigned_agent_id" AS "agentId",
             AVG(f."rating")::float AS "averageRating",
             COUNT(*) AS "total"
      FROM "feedback" f
      JOIN "tickets" t ON t."id" = f."ticket_id"
      WHERE t."assigned_agent_id" IS NOT NULL
      GROUP BY t."assigned_agent_id"
    `,
    prisma.sLARecord.count({ where: { resolvedAt: { not: null } } }),
    prisma.sLARecord.count({
      where: { resolvedAt: { not: null }, breachedAt: null, state: "COMPLETED" },
    }),
  ]);
  const agentWorkload = await Promise.all(
    agentProfiles.map(async ({ user, capacity, availability }) => ({
      agentId: user.id,
      name: user.name,
      active: user.active,
      capacity,
      availability,
      workload: await prisma.ticket.count({
        where: {
          assignedAgentId: user.id,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
    })),
  );
  const averageMinutes = (
    rows: { ticket: { createdAt: Date }; firstResponseAt?: Date | null; resolvedAt?: Date | null }[],
    value: "firstResponseAt" | "resolvedAt",
  ) => {
    if (!rows.length) return null;
    const sum = rows.reduce(
      (total, row) => total + row[value]!.getTime() - row.ticket.createdAt.getTime(),
      0,
    );
    return Math.round(sum / rows.length / 60_000);
  };
  const agentIds = agentCsat.map((item) => item.agentId);
  const agentNames = await prisma.user.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true },
  });
  const namesById = new Map(agentNames.map((agent) => [agent.id, agent.name]));
  res.json({
    metrics: {
      totalTickets: total,
      openTickets: open,
      pendingTickets: pending,
      resolvedTickets: resolved,
      closedTickets: closed,
      aiSelfServiceResolutions: selfService,
      slaBreaches: breached,
      slaCompliancePercent: slaTotal ? Math.round((slaMet / slaTotal) * 100) : null,
      averageFirstResponseMinutes: averageMinutes(responseRows, "firstResponseAt"),
      averageResolutionMinutes: averageMinutes(resolutionRows, "resolvedAt"),
      averageCsat: feedback._avg.rating,
      totalFeedback: feedback._count._all,
    },
    agentWorkload,
    agentCsat: agentCsat.map((item) => ({
      agentId: item.agentId,
      name: namesById.get(item.agentId) ?? "Inactive agent",
      averageRating: item.averageRating,
      total: Number(item.total),
    })),
    ratingDistribution: ratingDistribution.map((item) => ({
      rating: item.rating,
      total: item._count._all,
    })),
    byCategory: categoryGroups.map((item) => ({
      category: item.category,
      total: item._count._all,
    })),
    byPriority: priorityGroups.map((item) => ({
      priority: item.priority,
      total: item._count._all,
    })),
  });
});

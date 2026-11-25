import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { allowRoles, requireAuth } from "../middleware/auth";
import { agentSchema, agentUpdateSchema } from "../validators/schemas";
import { z } from "zod";
import { routeParam } from "../lib/route-param";

export const peopleRouter = Router();
peopleRouter.use(requireAuth);

peopleRouter.get("/agents", async (req, res) => {
  if (req.user!.role === "CUSTOMER") {
    const agents = await prisma.user.findMany({
      where: { role: "AGENT", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ agents });
    return;
  }
  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      agentProfile: true,
      assignedTickets: {
        where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });
  res.json({
    agents: agents.map(({ assignedTickets, ...agent }) => ({
      ...agent,
      workload: assignedTickets.length,
    })),
  });
});

peopleRouter.post(
  "/agents",
  allowRoles("ADMIN"),
  async (req, res) => {
    const input = agentSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const agent = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: "AGENT",
        active: input.active,
        agentProfile: {
          create: {
            skills: input.skills,
            team: input.team,
            capacity: input.capacity,
            availability: input.availability,
          },
        },
      },
      select: { id: true, name: true, email: true, active: true, agentProfile: true },
    });
    res.status(201).json({ agent });
  },
);

peopleRouter.patch(
  "/agents/:id",
  allowRoles("ADMIN"),
  async (req, res) => {
    const input = agentUpdateSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: { id: z.uuid().parse(routeParam(req, "id")), role: "AGENT" },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, "Agent not found.", "NOT_FOUND");
    const { skills, team, capacity, availability, ...userFields } = input;
    const agent = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...userFields,
        agentProfile: {
          update: {
            ...(skills ? { skills } : {}),
            ...(team ? { team } : {}),
            ...(capacity ? { capacity } : {}),
            ...(availability ? { availability } : {}),
          },
        },
      },
      select: { id: true, name: true, email: true, active: true, agentProfile: true },
    });
    res.json({ agent });
  },
);

peopleRouter.get("/customers", allowRoles("ADMIN"), async (_req, res) => {
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: { id: true, name: true, email: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ customers });
});

peopleRouter.patch(
  "/users/:id/status",
  allowRoles("ADMIN"),
  async (req, res) => {
    const input = z.object({ active: z.boolean() }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: z.uuid().parse(routeParam(req, "id")) },
      select: { id: true, role: true },
    });
    if (!user || user.role === "ADMIN")
      throw new HttpError(404, "Account not found.", "NOT_FOUND");
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { active: input.active },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    res.json({ user: updated });
  },
);

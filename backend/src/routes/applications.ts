import { Router } from "express";
import { prisma } from "../lib/prisma";

export const applicationsRouter = Router();
applicationsRouter.get("/", async (_req, res) => {
  const applications = await prisma.application.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      applicationCategory: true,
      description: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });
  res.json({ applications });
});

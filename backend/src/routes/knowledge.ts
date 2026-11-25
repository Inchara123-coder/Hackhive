import { Router } from "express";
import { ComplaintCategory } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { allowRoles, requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { routeParam } from "../lib/route-param";

const knowledgeSchema = z.object({
  application: z.string().trim().min(2).max(80).nullable().optional(),
  category: z.nativeEnum(ComplaintCategory),
  title: z.string().trim().min(2).max(160),
  problem: z.string().trim().min(5).max(500),
  possibleCause: z.string().trim().min(2).max(500),
  troubleshooting: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  recommended: z.string().trim().min(3).max(3000),
  keywords: z.array(z.string().trim().min(2).max(60)).max(30),
  approved: z.boolean().default(false),
});
const knowledgeUpdateSchema = knowledgeSchema.partial();

export const knowledgeRouter = Router();
knowledgeRouter.use(requireAuth);
knowledgeRouter.get("/", allowRoles("ADMIN"), async (req, res) => {
  const entries = await prisma.knowledgeBase.findMany({
    where: {
      active: true,
      ...(typeof req.query.approved === "string"
        ? { approved: req.query.approved === "true" }
        : {}),
    },
    include: { application: { select: { name: true } } },
    orderBy: [{ application: { name: "asc" } }, { category: "asc" }],
  });
  res.json({ entries });
});
knowledgeRouter.post("/", allowRoles("ADMIN"), validateBody(knowledgeSchema), async (req, res) => {
  const { application: applicationName, ...input } = req.body as z.infer<typeof knowledgeSchema>;
  const application = applicationName
    ? await prisma.application.findFirst({
        where: { name: applicationName, active: true },
        select: { id: true },
      })
    : null;
  if (applicationName && !application)
    throw new HttpError(400, "Choose an active application.", "INVALID_APPLICATION");
  const entry = await prisma.knowledgeBase.create({
    data: { ...input, applicationId: application?.id ?? null },
    include: { application: { select: { name: true } } },
  });
  res.status(201).json({ entry });
});
knowledgeRouter.patch("/:id", allowRoles("ADMIN"), validateBody(knowledgeUpdateSchema), async (req, res) => {
  const { application: applicationName, ...input } = req.body as z.infer<typeof knowledgeUpdateSchema>;
  const application = applicationName
    ? await prisma.application.findFirst({
        where: { name: applicationName, active: true },
        select: { id: true },
      })
    : null;
  if (applicationName && !application)
    throw new HttpError(400, "Choose an active application.", "INVALID_APPLICATION");
  const entry = await prisma.knowledgeBase.update({
    where: { id: routeParam(req, "id") },
    data: {
      ...input,
      ...(applicationName !== undefined
        ? { applicationId: application?.id ?? null }
        : {}),
    },
    include: { application: { select: { name: true } } },
  });
  res.json({ entry });
});
knowledgeRouter.delete("/:id", allowRoles("ADMIN"), async (req, res) => {
  await prisma.knowledgeBase.update({
    where: { id: routeParam(req, "id") },
    data: { active: false, approved: false },
  });
  res.status(204).end();
});

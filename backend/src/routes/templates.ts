import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { allowRoles, requireAuth } from "../middleware/auth";
import { routeParam } from "../lib/route-param";

export const templatesRouter = Router();
templatesRouter.use(requireAuth, allowRoles("ADMIN", "AGENT"));
const schema = z.object({
  title: z.string().trim().min(2).max(100),
  body: z.string().trim().min(1).max(3000),
});
templatesRouter.get("/", async (_req, res) => {
  res.json({ templates: await prisma.cannedResponse.findMany({ orderBy: { title: "asc" } }) });
});
templatesRouter.post("/", async (req, res) => {
  const input = schema.parse(req.body);
  const template = await prisma.cannedResponse.create({
    data: { ...input, authorId: req.user!.id },
  });
  res.status(201).json({ template });
});
templatesRouter.patch("/:id", async (req, res) => {
  const input = schema.partial().parse(req.body);
  const template = await prisma.cannedResponse.update({
    where: { id: routeParam(req, "id") },
    data: input,
  });
  res.json({ template });
});
templatesRouter.delete("/:id", async (req, res) => {
  await prisma.cannedResponse.delete({ where: { id: routeParam(req, "id") } });
  res.status(204).end();
});

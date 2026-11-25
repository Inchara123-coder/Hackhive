import { Router } from "express";
import { prisma } from "../lib/prisma";
import { allowRoles, requireAuth } from "../middleware/auth";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth, allowRoles("ADMIN"));
feedbackRouter.get("/", async (_req, res) => {
  const items = await prisma.feedback.findMany({
    include: {
      ticket: {
        select: {
          publicId: true,
          assignedAgent: { select: { id: true, name: true } },
        },
      },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const ratingDistribution = await prisma.feedback.groupBy({
    by: ["rating"],
    _count: { _all: true },
    orderBy: { rating: "asc" },
  });
  res.json({ feedback: items, ratingDistribution });
});

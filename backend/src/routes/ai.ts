import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { analyzeSchema } from "../validators/schemas";
import { analyzeComplaint } from "../services/ai-client";
import { findSolution } from "../services/knowledge";
import { allowRoles } from "../middleware/auth";
import { aiFeedbackSchema, solutionSearchSchema } from "../validators/schemas";
import { recordSolutionFeedback } from "../services/solution-feedback";
import { accessibleTicket } from "../services/ticket-access";

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.post(
  "/suggest-solution",
  validateBody(solutionSearchSchema),
  async (req, res) => {
    const solution = await findSolution(req.body);
    res.json({
      solution: solution
        ? {
            id: solution.entry.id,
            title: solution.entry.title,
            possibleCause: solution.entry.possibleCause,
            steps: solution.entry.troubleshooting,
            recommended: solution.entry.recommended,
            relevance: solution.relevance,
          }
        : null,
    });
  },
);

aiRouter.post(
  "/feedback",
  allowRoles("CUSTOMER"),
  validateBody(aiFeedbackSchema),
  async (req, res) => {
    const input = req.body as { publicId: string; resolved: boolean };
    const ticket = await accessibleTicket(input.publicId, req);
    await recordSolutionFeedback(ticket, req.user!.id, input.resolved);
    res.json({ accepted: true, resolved: input.resolved });
  },
);

aiRouter.post("/analyze", validateBody(analyzeSchema), async (req, res) => {
  const input = req.body as {
    application: string;
    subject: string;
    description: string;
  };
  const existing = await prisma.ticket.findMany({
    where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
    take: 100,
    orderBy: { createdAt: "desc" },
    select: { publicId: true, subject: true, description: true },
  });

  const analysis = await analyzeComplaint({
    ...input,
    existing: existing.map((ticket) => ({
      id: ticket.publicId,
      subject: ticket.subject,
      description: ticket.description,
    })),
  });
  const solution = await findSolution({
    ...input,
    category: analysis.category,
  });
  res.json({
    analysis,
    solution: solution
      ? {
          title: solution.entry.title,
          possibleCause: solution.entry.possibleCause,
          steps: solution.entry.troubleshooting,
          recommended: solution.entry.recommended,
          relevance: solution.relevance,
        }
      : null,
    duplicates: analysis.duplicates,
  });
});

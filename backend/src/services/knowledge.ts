import { prisma } from "../lib/prisma";
import type { ComplaintCategory } from "@prisma/client";
import { HttpError } from "../lib/http-error";

const STOP_WORDS = new Set(["the", "and", "for", "with", "that", "this", "from", "your", "have"]);

function terms(text: string) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? [],
  );
}

export async function findSolution(input: {
  application: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
}) {
  const application = await prisma.application.findUnique({
    where: { name: input.application },
    select: { id: true, active: true },
  });
  if (!application?.active)
    throw new HttpError(400, "Choose an active application.", "INVALID_APPLICATION");
  const other = await prisma.application.findUnique({
    where: { name: "Other" },
    select: { id: true },
  });
  const entries = await prisma.knowledgeBase.findMany({
    where: {
      approved: true,
      active: true,
      OR: [
        { applicationId: application.id },
        ...(other ? [{ applicationId: other.id }] : []),
        { applicationId: null },
      ],
    },
  });
  const complaintTerms = terms(`${input.subject} ${input.description}`);
  return entries
    .map((entry) => {
      const candidates = terms(
        `${entry.title} ${entry.problem} ${entry.possibleCause} ${entry.keywords.join(" ")}`,
      );
      const overlap = [...complaintTerms].filter((word) => candidates.has(word)).length;
      const lexical = overlap / Math.max(1, Math.min(complaintTerms.size, 12));
      const categoryMatch = entry.category === input.category ? 0.35 : 0;
      const appMatch = entry.applicationId === application.id ? 0.2 : 0;
      return {
        entry,
        relevance: Math.min(1, lexical * 0.65 + categoryMatch + appMatch),
      };
    })
    .filter((match) => match.relevance >= 0.3 && complaintTerms.size > 0)
    .sort((a, b) => b.relevance - a.relevance)[0];
}

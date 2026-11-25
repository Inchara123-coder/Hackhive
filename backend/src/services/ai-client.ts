import { env } from "../config/env";
import { HttpError } from "../lib/http-error";
import { ComplaintCategory, Sentiment, TicketPriority } from "@prisma/client";
import { z } from "zod";

const resultSchema = z.object({
  category: z.nativeEnum(ComplaintCategory),
  categoryConfidence: z.number().min(0).max(1),
  priority: z.nativeEnum(TicketPriority),
  priorityConfidence: z.number().min(0).max(1),
  sentiment: z.nativeEnum(Sentiment),
  sentimentScore: z.number().min(-1).max(1),
  priorityReason: z.string().min(1).max(500),
  modelVersion: z.string().min(1).max(80),
  duplicates: z.array(
    z.object({
      ticketId: z.string().min(1).max(40),
      score: z.number().min(0).max(1),
    }),
  ).max(5),
});

export type AIResult = z.infer<typeof resultSchema>;

export async function analyzeComplaint(input: {
  application: string;
  subject: string;
  description: string;
  existing?: { id: string; subject: string; description: string }[];
}): Promise<AIResult> {
  let response: Response;
  try {
    response = await fetch(new URL("/analyze", env.AI_SERVICE_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new HttpError(503, "Complaint analysis is temporarily unavailable; no ticket was saved. Please retry.", "AI_UNAVAILABLE");
  }
  if (!response.ok)
    throw new HttpError(503, "Complaint analysis failed; no ticket was saved. Please retry.", "AI_FAILED");
  try {
    return resultSchema.parse(await response.json());
  } catch {
    throw new HttpError(503, "Complaint analysis returned an invalid response; no ticket was saved.", "AI_INVALID_RESPONSE");
  }
}

import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { canAccessTicket, customerSafeTicket } from "../lib/ticket-access-policy";

export async function accessibleTicket(publicId: string, req: Request) {
  const ticket = await prisma.ticket.findUnique({
    where: { publicId },
    include: {
      application: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, email: true } },
      assignedAgent: { select: { id: true, name: true, email: true } },
      sla: { include: { policy: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      suggestions: {
        orderBy: { relevance: "desc" },
        include: {
          knowledgeBase: {
            select: {
              title: true,
              possibleCause: true,
              application: { select: { name: true } },
            },
          },
        },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          agent: { select: { id: true, name: true } },
          assignedBy: { select: { id: true, name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      internalNotes: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
      history: { orderBy: { createdAt: "asc" } },
      feedback: true,
      attachments: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          storageName: true,
          uploadedById: true,
        },
      },
    },
  });
  if (!ticket) throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
  const user = req.user;
  if (!user) throw new HttpError(401, "Sign in is required.", "UNAUTHENTICATED");
  if (!canAccessTicket(user.role, user.id, ticket))
    throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
  return ticket;
}

export function publicTicketView<
  T extends Parameters<typeof customerSafeTicket>[0] & {
    application: { name: string };
    analyses: unknown[];
  },
>(
  ticket: T,
  staff: boolean,
) {
  const view = staff ? ticket : customerSafeTicket(ticket);
  const { application: _application, analyses: _analyses, ...fields } = view;
  return {
    ...fields,
    application: ticket.application.name,
    analysis: ticket.analyses[0] ?? null,
  };
}

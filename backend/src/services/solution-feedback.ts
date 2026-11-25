import { CustomerSolutionResponse, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { assignAutomatically } from "./assignment";
import { completeSla } from "./sla";
import { notifyAdmins, notifyUser } from "./notifications";

type TicketForFeedback = {
  id: string;
  publicId: string;
  customerId: string;
  status: TicketStatus;
  suggestions: { id: string }[];
};

export async function recordSolutionFeedback(
  ticket: TicketForFeedback,
  customerId: string,
  resolved: boolean,
) {
  if (ticket.customerId !== customerId)
    throw new HttpError(404, "Ticket not found.", "NOT_FOUND");
  if (ticket.status !== TicketStatus.SELF_SERVICE)
    throw new HttpError(409, "This complaint is no longer awaiting a solution response.", "INVALID_TICKET_STATE");
  const suggestion = ticket.suggestions[0];
  if (!suggestion)
    throw new HttpError(409, "No approved solution is attached to this complaint.", "SOLUTION_NOT_FOUND");
  const at = new Date();
  await prisma.$transaction(async (tx) => {
    const updatedTicket = await tx.ticket.updateMany({
      where: {
        id: ticket.id,
        customerId,
        status: TicketStatus.SELF_SERVICE,
      },
      data: resolved
        ? {
            status: TicketStatus.RESOLVED,
            selfServiceResolved: true,
            resolutionMethod: "AI_SELF_SERVICE",
            resolvedAt: at,
            closedAt: null,
          }
        : { status: TicketStatus.OPEN, resolvedAt: null, closedAt: null },
    });
    if (!updatedTicket.count)
      throw new HttpError(409, "This complaint is no longer awaiting a solution response.", "INVALID_TICKET_STATE");
    const updatedSuggestion = await tx.aISuggestion.updateMany({
      where: { id: suggestion.id, ticketId: ticket.id, confirmedAt: null },
      data: {
        customerChoice: resolved,
        customerResponse: resolved
          ? CustomerSolutionResponse.SOLVED
          : CustomerSolutionResponse.NOT_SOLVED,
        confirmedAt: at,
      },
    });
    if (!updatedSuggestion.count)
      throw new HttpError(409, "This solution has already received a response.", "SOLUTION_ALREADY_ANSWERED");
    await tx.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: customerId,
        actionType: "SOLUTION_FEEDBACK",
        event: resolved
          ? "Customer confirmed self-service resolution"
          : "Customer requested agent assistance",
        oldValue: { status: TicketStatus.SELF_SERVICE },
        newValue: {
          status: resolved ? TicketStatus.RESOLVED : TicketStatus.OPEN,
          customerResponse: resolved ? "SOLVED" : "NOT_SOLVED",
        },
        ...(resolved ? { details: { method: "AI_SELF_SERVICE" } } : {}),
      },
    });
  });
  if (resolved) {
    await completeSla(ticket.id, at);
    await notifyUser(
      customerId,
      "TICKET_RESOLVED",
      `Complaint ${ticket.publicId} was marked resolved.`,
      ticket.id,
    );
    return;
  }
  await notifyAdmins(
    "CUSTOMER_REJECTED_SOLUTION",
    `Customer requested agent assistance for ${ticket.publicId}.`,
    ticket.id,
  );
  await assignAutomatically(ticket.id);
}

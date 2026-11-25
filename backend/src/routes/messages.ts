import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { messageSchema } from "../validators/schemas";
import { accessibleTicket } from "../services/ticket-access";
import { markFirstResponse } from "../services/sla";
import { notifyUser, notifyAdmins } from "../services/notifications";
import { emitIfReady } from "../sockets";
import { HttpError } from "../lib/http-error";
import { routeParam } from "../lib/route-param";

export const messagesRouter = Router({ mergeParams: true });
messagesRouter.use(requireAuth);

messagesRouter.get("/", async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  res.json({ messages: ticket.messages });
});

messagesRouter.post("/", validateBody(messageSchema), async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED")
    throw new HttpError(409, "Closed complaints cannot receive new messages.", "TICKET_RESOLVED");
  const { body } = req.body as { body: string };
  const message = await prisma.message.create({
    data: { ticketId: ticket.id, authorId: req.user!.id, body },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  if (req.user!.role === "AGENT" || req.user!.role === "ADMIN") {
    await markFirstResponse(ticket.id, message.createdAt);
    await notifyUser(
      ticket.customerId,
      "NEW_MESSAGE",
      `Your support agent replied to ${ticket.publicId}.`,
      ticket.id,
    );
  } else if (req.user!.role === "CUSTOMER") {
    if (ticket.assignedAgentId)
      await notifyUser(
        ticket.assignedAgentId,
        "NEW_MESSAGE",
        `A customer replied to ${ticket.publicId}.`,
        ticket.id,
      );
    await notifyAdmins("NEW_MESSAGE", `A customer replied to ${ticket.publicId}.`, ticket.id);
  } else {
    if (ticket.assignedAgentId)
      await notifyUser(
        ticket.assignedAgentId,
        "NEW_MESSAGE",
        `A support reply was added to ${ticket.publicId}.`,
        ticket.id,
      );
    await notifyUser(
      ticket.customerId,
      "NEW_MESSAGE",
      `A support reply was added to ${ticket.publicId}.`,
      ticket.id,
    );
  }
  emitIfReady(`ticket:${ticket.id}`, "ticket:message", message);
  res.status(201).json({ message });
});


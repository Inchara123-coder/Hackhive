import { Router } from "express";
import { prisma } from "../lib/prisma";
import { allowRoles, requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { messageSchema } from "../validators/schemas";
import { accessibleTicket } from "../services/ticket-access";
import { emitIfReady } from "../sockets";
import { routeParam } from "../lib/route-param";

export const internalNotesRouter = Router({ mergeParams: true });
internalNotesRouter.use(requireAuth, allowRoles("ADMIN", "AGENT"));
internalNotesRouter.get("/", async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  res.json({ notes: ticket.internalNotes });
});
internalNotesRouter.post("/", validateBody(messageSchema), async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  const { body } = req.body as { body: string };
  const note = await prisma.internalNote.create({
    data: { ticketId: ticket.id, authorId: req.user!.id, body },
    include: { author: { select: { id: true, name: true } } },
  });
  const recipients = new Set([req.user!.id, ticket.assignedAgentId].filter(Boolean) as string[]);
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  admins.forEach((admin) => recipients.add(admin.id));
  for (const id of recipients)
    emitIfReady(`user:${id}`, "ticket:internal-note", { ticketId: ticket.id, note });
  res.status(201).json({ note });
});

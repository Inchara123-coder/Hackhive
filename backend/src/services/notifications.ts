import { prisma } from "../lib/prisma";
import { emitIfReady } from "../sockets";
import type { NotificationType } from "@prisma/client";

const titles: Record<NotificationType, string> = {
  TICKET_CREATED: "Complaint created",
  AI_SOLUTION: "Troubleshooting ready",
  CUSTOMER_REJECTED_SOLUTION: "Customer requested support",
  TICKET_ASSIGNED: "Ticket assigned",
  NEW_MESSAGE: "New message",
  SLA_WARNING: "SLA deadline approaching",
  SLA_BREACH: "SLA deadline breached",
  ESCALATION: "Ticket escalated",
  TICKET_RESOLVED: "Ticket resolved",
  FEEDBACK: "Customer feedback received",
  ADMIN_ACTION: "Ticket updated",
};

export async function notifyUser(
  userId: string,
  type: NotificationType,
  message: string,
  ticketId?: string,
) {
  const notification = await prisma.notification.create({
    data: { userId, type, title: titles[type], message, ticketId },
  });
  emitIfReady(`user:${userId}`, "notification:new", notification);
  return notification;
}

export async function notifyAdmins(
  type: NotificationType,
  message: string,
  ticketId?: string,
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  await Promise.all(admins.map((admin) => notifyUser(admin.id, type, message, ticketId)));
}

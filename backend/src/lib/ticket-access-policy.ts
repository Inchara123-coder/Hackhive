import type { Role } from "@prisma/client";

export function canAccessTicket(
  role: Role,
  userId: string,
  ticket: { customerId: string; assignedAgentId: string | null },
) {
  return (
    role === "ADMIN" ||
    (role === "CUSTOMER" && ticket.customerId === userId) ||
    (role === "AGENT" && ticket.assignedAgentId === userId)
  );
}

export function customerSafeTicket<
  T extends {
    internalNotes: unknown[];
    history: { isPublic: boolean; details: unknown }[];
    assignments: { assignedAt: Date; agent: { id: string; name: string } }[];
    assignedAgent: { id: string; name: string; email: string } | null;
    attachments: {
      storageName: string;
      uploadedById: string;
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
    }[];
  },
>(ticket: T) {
  const {
    internalNotes: _internalNotes,
    history,
    assignments,
    assignedAgent,
    attachments,
    ...publicFields
  } = ticket;
  return {
    ...publicFields,
    history: history
      .filter((entry) => entry.isPublic)
      .map(({ isPublic: _isPublic, details: _details, ...event }) => event),
    assignments: assignments.map(({ assignedAt, agent }) => ({
      assignedAt,
      agent: { name: agent.name },
    })),
    assignedAgent: assignedAgent
      ? { id: assignedAgent.id, name: assignedAgent.name }
      : null,
    attachments: attachments.map(
      ({ storageName: _storageName, uploadedById: _uploadedById, ...attachment }) =>
        attachment,
    ),
  };
}

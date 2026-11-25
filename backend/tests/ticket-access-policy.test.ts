import { describe, expect, it } from "vitest";
import { canAccessTicket, customerSafeTicket } from "../src/lib/ticket-access-policy";

const ticket = { customerId: "customer-1", assignedAgentId: "agent-1" };

describe("ticket access policy", () => {
  it("allows customers to access only their own ticket", () => {
    expect(canAccessTicket("CUSTOMER", "customer-1", ticket)).toBe(true);
    expect(canAccessTicket("CUSTOMER", "customer-2", ticket)).toBe(false);
  });

  it("allows agents to access only assigned tickets and admins to access all tickets", () => {
    expect(canAccessTicket("AGENT", "agent-1", ticket)).toBe(true);
    expect(canAccessTicket("AGENT", "agent-2", ticket)).toBe(false);
    expect(canAccessTicket("ADMIN", "admin-1", ticket)).toBe(true);
  });
});

describe("customer ticket response", () => {
  it("omits private notes, private history details, staff emails and storage metadata", () => {
    const result = customerSafeTicket({
      internalNotes: [{ body: "staff only" }],
      history: [
        { isPublic: true, details: { private: "metadata" }, event: "created" },
        { isPublic: false, details: { secret: true }, event: "internal" },
      ],
      assignments: [{ assignedAt: new Date(), agent: { id: "agent-1", name: "Agent" } }],
      assignedAgent: { id: "agent-1", name: "Agent", email: "private@example.test" },
      attachments: [{
        id: "attachment-1",
        originalName: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        createdAt: new Date(),
        storageName: "random-private-name.pdf",
        uploadedById: "user-1",
      }],
      publicId: "SSL-TEST",
    });

    expect(result).not.toHaveProperty("internalNotes");
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).not.toHaveProperty("details");
    expect(result.assignments[0].agent).toEqual({ name: "Agent" });
    expect(result.assignedAgent).not.toHaveProperty("email");
    expect(result.attachments[0]).not.toHaveProperty("storageName");
    expect(result.attachments[0]).not.toHaveProperty("uploadedById");
  });
});

import { categories, priorities, type Database, type Ticket } from "@/types";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const accounts = {
  admin: { id: "admin", name: "Alex Morgan", email: "admin@relaydesk.demo" },
  agent: { id: "a1", name: "Sarah Chen", email: "agent@relaydesk.demo" },
  customer: {
    id: "c1",
    name: "Olivia Parker",
    email: "customer@relaydesk.demo",
  },
};
export const demoPassword = "RelayDesk123!";
const subjects = [
  "Unable to access billing dashboard",
  "Payment failed on subscription renewal",
  "SSO login redirects to a blank page",
  "Update primary contact for workspace",
  "Exported report is missing transactions",
  "API requests returning timeout errors",
  "Upgrade our workspace subscription",
  "Need help updating account permissions",
  "Invoice has an incorrect tax amount",
  "Mobile app keeps signing me out",
  "Webhook delivery is delayed",
  "Request for additional workspace seats",
  "Unable to download monthly statements",
  "Reset two-factor authentication",
  "Clarify data export options",
  "Email alerts are arriving twice",
  "Change the billing cycle",
  "Dashboard filters reset after refresh",
  "Restore archived project access",
  "Question about team onboarding",
  "Update company address on receipts",
  "Integrate workspace with reporting tools",
  "File uploads stall on slow networks",
  "How do I update notification settings?",
];
const details = [
  "Our finance team cannot open the billing dashboard. The page loads briefly and then shows an error. Could you check whether our workspace still has billing access?",
  "The card on file was charged last month, but today the renewal failed. Please help us restore the subscription before the next billing cycle.",
  "Several coworkers reach a blank page after completing single sign-on. The same issue happens in a private window.",
  "Our former account owner has left the team. We need to update the primary contact without changing our existing workspace permissions.",
  "The CSV export excludes several completed transactions from last week. The transactions are visible on screen.",
];
export function seed(now = Date.now()): Database {
  const agents: Database["agents"] = [
    {
      ...accounts.agent,
      active: true,
      availability: "Available",
      capacity: 9,
      team: "Technical Support",
    },
    {
      id: "a2",
      name: "Marcus Rivera",
      email: "marcus@relaydesk.demo",
      active: true,
      availability: "Busy",
      capacity: 4,
      team: "Technical Support",
    },
    {
      id: "a3",
      name: "Priya Patel",
      email: "priya@relaydesk.demo",
      active: true,
      availability: "Available",
      capacity: 12,
      team: "Customer Success",
    },
    {
      id: "a4",
      name: "James Wilson",
      email: "james@relaydesk.demo",
      active: true,
      availability: "Offline",
      capacity: 8,
      team: "Billing Support",
    },
    {
      id: "a5",
      name: "Amina Okafor",
      email: "amina@relaydesk.demo",
      active: true,
      availability: "Available",
      capacity: 14,
      team: "Customer Success",
    },
  ];
  const customers: Database["customers"] = [
    { ...accounts.customer, active: true },
    ...[
      "Noah Williams",
      "Emma Davis",
      "Liam Brooks",
      "Mia Thompson",
      "Ethan Martin",
      "Ava Robinson",
    ].map((name, i) => ({
      id: "c" + (i + 2),
      name,
      email: name.toLowerCase().replace(" ", ".") + "@example.com",
      active: true,
    })),
  ];
  const tickets: Ticket[] = Array.from({ length: 128 }, (_, i) => {
    const milestones = [0, 13, 19, 43, 56, 82, 100, 113, 121];
    const bucket =
      i < 7 ? 0 : milestones.findLastIndex((start) => i - 7 >= start);
    const bucketSize = (milestones[bucket + 1] ?? 126) - milestones[bucket];
    const createdAt =
      now -
      (i < 7
        ? (i + 1) * 0.85
        : 6.5 + 23.5 * (bucket + (i - 7 - milestones[bucket]) / bucketSize)) *
        HOUR;
    const status =
      i < 7
        ? (
            [
              "Open",
              "Pending",
              "In progress",
              "Resolved",
              "Open",
              "Open",
              "Pending",
            ] as const
          )[i]
        : i % 11 < 7
          ? "Resolved"
          : i % 11 === 7
            ? "Pending"
            : i % 11 === 8
              ? "In progress"
              : "Open";
    const priority =
      i < 7
        ? (
            [
              "Urgent",
              "High",
              "Urgent",
              "Low",
              "Medium",
              "High",
              "Medium",
            ] as const
          )[i]
        : i % 12 === 0
          ? "Urgent"
          : i % 5 === 0
            ? "High"
            : i % 3 === 0
              ? "Low"
              : "Medium";
    const customer = customers[i % customers.length];
    const agent = agents[(i === 2 ? 1 : i) % agents.length];
    const resolvedAt =
      status === "Resolved"
        ? Math.min(now - 60000, createdAt + (i === 3 ? 2 : 2 + (i % 18)) * HOUR)
        : undefined;
    const dueAt =
      i < 7
        ? now + [0.37, 1.13, -0.53, 36, 51, 2.85, 18][i] * HOUR
        : resolvedAt
          ? createdAt + (i % 19 === 0 ? 2 : 48) * HOUR
          : now + (i % 13 === 0 ? -1 - (i % 4) : 10 + (i % 72)) * HOUR;
    const subject = subjects[i % subjects.length];
    const description = details[i % details.length];
    return {
      id: "RD-" + (1128 - i),
      subject,
      description,
      customerId: customer.id,
      agentId: agent.id,
      category:
        i < 5
          ? (
              ["Billing", "Billing", "Technical", "Account", "Product"] as const
            )[i]
          : categories[(i * 3) % 5],
      status,
      priority,
      reason:
        priority === "Urgent"
          ? "The issue blocks a core workflow."
          : "Priority reflects the reported impact.",
      createdAt,
      dueAt,
      resolvedAt,
      assignment: i % 9 === 4 ? "Manual" : "Automatic",
      escalated: !resolvedAt && dueAt < now,
      attachments: [],
      messages:
        i % 3 === 0
          ? [
              {
                id: "m" + i,
                at: createdAt + 120000,
                author: agent.name,
                text: "Thanks for reaching out. I’m looking into this and will share an update here.",
              },
              {
                id: "n" + i,
                at: createdAt + 180000,
                author: agent.name,
                text: "Check the workspace audit log before requesting another diagnostic. Reference: QA-47.",
                private: true,
              },
            ]
          : [],
      feedback:
        resolvedAt && i % 5 !== 0
          ? {
              rating: i % 5 === 2 ? 4 : 5,
              text: "Thanks for helping us get back on track.",
            }
          : undefined,
      history: [
        { text: "Ticket created", at: createdAt },
        { text: "Assigned to " + agent.name, at: createdAt + 30000 },
        ...(resolvedAt ? [{ text: "Ticket resolved", at: resolvedAt }] : []),
      ],
    };
  });
  return {
    tickets,
    agents,
    customers,
    sla: Object.fromEntries(
      priorities.map((p, i) => [p, [4, 12, 24, 72][i]]),
    ) as Database["sla"],
    notices: [
      {
        id: "welcome-1",
        recipient: "c1",
        ticketId: tickets[0].id,
        text: "Sarah Chen replied to your ticket.",
        at: now - HOUR / 2,
        read: false,
      },
      {
        id: "welcome-2",
        recipient: "c1",
        ticketId: tickets[0].id,
        text: "Your ticket was assigned to Sarah Chen.",
        at: now - HOUR * 0.7,
        read: false,
      },
      {
        id: "welcome-3",
        recipient: "a1",
        ticketId: tickets[0].id,
        text: "An urgent billing ticket was assigned to you.",
        at: now - HOUR * 0.7,
        read: false,
      },
    ],
    templates: [
      {
        id: "t1",
        title: "Acknowledge request",
        text: "Thanks for contacting support. I’m reviewing your request and will update you here shortly.",
      },
      {
        id: "t2",
        title: "Request more details",
        text: "Could you share the steps you followed and the exact error message? Please remove any sensitive details before sharing.",
      },
      {
        id: "t3",
        title: "Confirm resolution",
        text: "We’ve applied a fix. Please try again and let us know if you still experience the issue.",
      },
    ],
  };
}

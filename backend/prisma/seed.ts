import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  AgentAvailability,
  ComplaintCategory,
  PrismaClient,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { env } from "../src/config/env";

const prisma = new PrismaClient();
const categories = Object.values(ComplaintCategory);
const applications = [
  "Google Pay",
  "PhonePe",
  "Amazon",
  "Flipkart",
  "Swiggy",
  "Zomato",
  "Uber",
  "Rapido",
  "MyJio",
  "Airtel Thanks",
  "Netflix",
  "Other",
];
const applicationCategories: Record<string, string> = {
  "Google Pay": "Digital payments",
  PhonePe: "Digital payments",
  Amazon: "E-commerce",
  Flipkart: "E-commerce",
  Swiggy: "Food delivery",
  Zomato: "Food delivery",
  Uber: "Transportation",
  Rapido: "Transportation",
  MyJio: "Telecommunications",
  "Airtel Thanks": "Telecommunications",
  Netflix: "Entertainment",
  Other: "General",
};
const complaints: {
  subject: string;
  description: string;
  category: ComplaintCategory;
  priority: TicketPriority;
}[] = [
  { subject: "Payment failed after bank debit", description: "The amount was deducted but the payment status is failed. Please help me check the transaction.", category: "PAYMENT", priority: "URGENT" },
  { subject: "Cannot sign in to my account", description: "The app returns to the login screen after I enter the correct one-time password.", category: "LOGIN", priority: "HIGH" },
  { subject: "Refund still pending", description: "My order was cancelled several days ago and I do not see a refund in the bank statement.", category: "REFUND", priority: "HIGH" },
  { subject: "Delivery marked complete but missing", description: "The delivery status says complete, but I have not received the parcel at my address.", category: "DELIVERY", priority: "HIGH" },
  { subject: "App closes on launch", description: "The app crashes immediately after opening on my phone, even after restarting the device.", category: "TECHNICAL", priority: "HIGH" },
  { subject: "Update account contact details", description: "I need guidance on changing the email address linked to my profile.", category: "ACCOUNT", priority: "NORMAL" },
  { subject: "Connection unavailable on mobile data", description: "The service does not load on mobile data, although other websites are reachable.", category: "NETWORK", priority: "NORMAL" },
  { subject: "Subscription charged twice", description: "I can see two subscription charges with the same date and amount in my bank statement.", category: "SUBSCRIPTION", priority: "HIGH" },
  { subject: "Question about app settings", description: "Where can I change the notification settings for my account?", category: "OTHER", priority: "NORMAL" },
  { subject: "Possible unauthorized account access", description: "I see a sign in I do not recognize and need to secure my account immediately.", category: "ACCOUNT", priority: "URGENT" },
];

const knowledge = [
  {
    application: "Google Pay", category: "PAYMENT" as const, title: "Payment debited but failed",
    problem: "A payment failed after the account was debited.", possibleCause: "The bank or payment network may still be processing the transaction.",
    troubleshooting: ["Check the transaction status in Google Pay.", "Check the bank transaction history.", "Verify whether the amount was reversed.", "If it is not reversed within the provider's stated period, contact the bank or payment provider through official support."],
    recommended: "Do not retry repeatedly while the transaction is pending. Use the provider's official support channel for account-specific help.",
    keywords: ["payment", "failed", "debit", "deducted", "transaction"], approved: true,
  },
  {
    application: "PhonePe", category: "PAYMENT" as const, title: "Payment status pending",
    problem: "A transfer remains pending or failed after initiating a payment.", possibleCause: "The payment network may need time to update the transaction status.",
    troubleshooting: ["Open the transaction details in PhonePe.", "Check your bank statement for the debit or reversal.", "Avoid creating repeated transfers for the same payment.", "Contact PhonePe or your bank using its official support options if the status does not update."],
    recommended: "Keep the transaction reference available when contacting official support. Do not share OTPs or payment PINs.",
    keywords: ["payment", "pending", "failed", "upi", "transfer"], approved: true,
  },
  {
    application: "Amazon", category: "DELIVERY" as const, title: "Order delivery status needs checking",
    problem: "An order is delayed or marked delivered but cannot be found.", possibleCause: "Delivery status updates can precede physical handoff or the parcel may have been left at a designated location.",
    troubleshooting: ["Review the latest tracking update.", "Check the delivery location and ask household members or building reception.", "Use the order's official help option if the parcel remains missing."],
    recommended: "Use Amazon's official order support to request an investigation. This helpdesk cannot access or change your order.",
    keywords: ["amazon", "order", "delivery", "delayed", "delivered", "parcel"], approved: true,
  },
  {
    application: "Flipkart", category: "DELIVERY" as const, title: "Check a delayed or missing order",
    problem: "An order has not arrived or its tracking state is unclear.", possibleCause: "Courier status may take time to refresh or the delivery may need provider review.",
    troubleshooting: ["Check the order tracking page.", "Confirm the delivery address and estimated date.", "Use Flipkart's official help center if the order is late or missing."],
    recommended: "Keep the order ID private except when sharing it through the provider's official support.",
    keywords: ["flipkart", "order", "delivery", "late", "missing"], approved: true,
  },
  {
    application: "Swiggy", category: "DELIVERY" as const, title: "Food order delayed or incomplete",
    problem: "A food order is delayed or has missing items.", possibleCause: "The order may be delayed in preparation or delivery.", 
    troubleshooting: ["Check live order tracking.", "Confirm the delivery handoff details.", "Report missing items through the order's official help flow."],
    recommended: "Use Swiggy's in-app support so the order can be reviewed by its support team.",
    keywords: ["swiggy", "food", "delivery", "missing", "late"], approved: true,
  },
  {
    application: "Zomato", category: "DELIVERY" as const, title: "Food order status or missing items",
    problem: "A restaurant order is delayed or incomplete.", possibleCause: "Preparation or delivery details may require review by the platform.", 
    troubleshooting: ["Open the order details and review tracking.", "Check the delivered items against the order.", "Report the issue from Zomato's official order-help screen."],
    recommended: "Do not share payment credentials in a support conversation.",
    keywords: ["zomato", "food", "order", "missing", "delivery"], approved: true,
  },
  {
    application: "Uber", category: "ACCOUNT" as const, title: "Review account access",
    problem: "The user cannot access an account or sees an unrecognized sign-in.", possibleCause: "The account may require identity verification or a security review.", 
    troubleshooting: ["Use the official account recovery flow.", "Update your password from the official app or website.", "Never share one-time codes with another person.", "Contact Uber support through its official help center."],
    recommended: "This helpdesk cannot access or change your Uber account.",
    keywords: ["uber", "account", "login", "access", "security"], approved: true,
  },
  {
    application: "Rapido", category: "ACCOUNT" as const, title: "Account access guidance",
    problem: "The user needs help signing in or reviewing account access.", possibleCause: "The account may need recovery or identity verification.", 
    troubleshooting: ["Use the official account recovery options.", "Check that the registered mobile number is available.", "Contact Rapido support from its official app or website."],
    recommended: "Never provide your OTP, password, or payment PIN to someone claiming to help.",
    keywords: ["rapido", "account", "login", "access"], approved: true,
  },
  {
    application: "MyJio", category: "NETWORK" as const, title: "Basic connectivity checks",
    problem: "The app or service reports a connection problem.", possibleCause: "Network coverage, device settings, or service availability may affect connectivity.", 
    troubleshooting: ["Check whether other sites load on the same connection.", "Toggle airplane mode and retry.", "Restart the device and check for app updates.", "Use Jio's official support channels for account or network checks."],
    recommended: "Do not share account verification codes in this helpdesk.",
    keywords: ["myjio", "network", "internet", "connection", "offline"], approved: true,
  },
  {
    application: "Airtel Thanks", category: "NETWORK" as const, title: "Connectivity troubleshooting",
    problem: "The app or service cannot connect reliably.", possibleCause: "Network coverage or local device connectivity may be affecting service.",
    troubleshooting: ["Check signal and connectivity.", "Restart the device and retry.", "Update the Airtel Thanks app.", "Contact Airtel through official support for line-specific checks."],
    recommended: "This helpdesk cannot access carrier account information.",
    keywords: ["airtel", "network", "internet", "connection", "signal"], approved: true,
  },
  {
    application: "Netflix", category: "SUBSCRIPTION" as const, title: "Playback or subscription checks",
    problem: "Video playback fails or a subscription does not appear active.", possibleCause: "Connectivity, app version, or subscription status may need checking.",
    troubleshooting: ["Check internet connectivity.", "Restart and update the application.", "Check whether the subscription is active through the official account page.", "Contact Netflix through its official help center if the issue continues."],
    recommended: "Do not share account passwords or payment details with support.",
    keywords: ["netflix", "video", "playback", "subscription", "streaming"], approved: true,
  },
  {
    application: "Other", category: "LOGIN" as const, title: "General account sign-in checks",
    problem: "A customer cannot sign in to an application.", possibleCause: "A temporary service issue, outdated app, or account verification may prevent sign-in.",
    troubleshooting: ["Confirm the service is online using its official status page.", "Update and restart the application.", "Use the provider's official account recovery flow.", "Contact the provider through its official support channel if access remains blocked."],
    recommended: "Never share passwords, one-time codes, or recovery links with support.",
    keywords: ["login", "sign in", "account", "password", "access"], approved: true,
  },
  {
    application: "Other", category: "REFUND" as const, title: "General refund status guidance",
    problem: "A refund has not appeared after a cancellation or return.", possibleCause: "The provider or bank may still be processing the refund.",
    troubleshooting: ["Review the provider's refund status and stated processing time.", "Check the original payment method for a reversal.", "Contact the provider using its official order or transaction support flow."],
    recommended: "This helpdesk cannot initiate or guarantee a refund.",
    keywords: ["refund", "return", "cancel", "money", "reversal"], approved: true,
  },
  {
    application: "Other", category: "TECHNICAL" as const, title: "General application crash checks",
    problem: "An application closes unexpectedly or fails to open.", possibleCause: "An outdated app, device storage issue, or temporary service problem may cause crashes.",
    troubleshooting: ["Restart the device and install available app updates.", "Check that the device has sufficient free storage.", "Use the provider's official status page to check for an outage.", "Contact the provider through its official support channel if the issue continues."],
    recommended: "Do not remove account data or reinstall until important local data is backed up.",
    keywords: ["crash", "crashing", "close", "technical", "launch"], approved: true,
  },
  {
    application: "Other", category: "SUBSCRIPTION" as const, title: "General subscription billing checks",
    problem: "A subscription payment appears duplicated or the subscription is inactive after payment.", possibleCause: "The billing provider may need time to update payment status.",
    troubleshooting: ["Review the subscription status through the provider's official account page.", "Check the payment method for duplicate or pending charges.", "Contact the provider using its official billing support channel."],
    recommended: "Do not share full payment card details or security codes.",
    keywords: ["subscription", "billing", "charged", "payment", "renewal"], approved: true,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(env.DEMO_SEED_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@smartsla.demo" },
    update: { name: "SmartSLA Admin", passwordHash, active: true },
    create: { name: "SmartSLA Admin", email: "admin@smartsla.demo", passwordHash, role: "ADMIN" },
  });
  const agentInputs = [
    ["agent1@smartsla.demo", "Asha Rao", [ComplaintCategory.PAYMENT, ComplaintCategory.REFUND, ComplaintCategory.SUBSCRIPTION], "Billing Support"],
    ["agent2@smartsla.demo", "Rohan Mehta", [ComplaintCategory.DELIVERY, ComplaintCategory.OTHER], "Order Support"],
    ["agent3@smartsla.demo", "Maya Singh", [ComplaintCategory.LOGIN, ComplaintCategory.ACCOUNT], "Account Support"],
    ["agent4@smartsla.demo", "Arjun Patel", [ComplaintCategory.NETWORK, ComplaintCategory.TECHNICAL], "Technical Support"],
    ["agent5@smartsla.demo", "Sara Khan", categories, "Customer Support"],
  ] as const;
  const agents = [];
  for (const [email, name, skills, team] of agentInputs) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, active: true },
      create: { email, name, passwordHash, role: "AGENT" },
    });
    await prisma.agentProfile.upsert({
      where: { userId: user.id },
      update: { skills: [...skills], team, capacity: 10, availability: AgentAvailability.AVAILABLE },
      create: { userId: user.id, skills: [...skills], team, capacity: 10, availability: AgentAvailability.AVAILABLE },
    });
    agents.push(user);
  }
  const customers = [];
  for (let index = 1; index <= 10; index += 1) {
    customers.push(
      await prisma.user.upsert({
        where: { email: `customer${index}@smartsla.demo` },
        update: { name: `Demo Customer ${index}`, passwordHash, active: true },
        create: {
          name: `Demo Customer ${index}`,
          email: `customer${index}@smartsla.demo`,
          passwordHash,
          role: "CUSTOMER",
        },
      }),
    );
  }

  const applicationIds = new Map<string, string>();
  for (const name of applications) {
    const application = await prisma.application.upsert({
      where: { name },
      update: {
        applicationCategory: applicationCategories[name],
        description: `Synthetic support catalog record for ${name}.`,
        active: true,
      },
      create: {
        name,
        applicationCategory: applicationCategories[name],
        description: `Synthetic support catalog record for ${name}.`,
      },
    });
    applicationIds.set(name, application.id);
  }

  const policyRows = [
    { priority: TicketPriority.URGENT, firstResponseMins: 15, resolutionMins: 120, warningMins: 15 },
    { priority: TicketPriority.HIGH, firstResponseMins: 60, resolutionMins: 480, warningMins: 30 },
    { priority: TicketPriority.NORMAL, firstResponseMins: 240, resolutionMins: 1440, warningMins: 60 },
  ];
  const policies = new Map<TicketPriority, { id: string; resolutionMins: number; firstResponseMins: number }>();
  for (const policy of policyRows) {
    const saved = await prisma.sLAPolicy.upsert({
      where: { priority: policy.priority },
      update: policy,
      create: policy,
    });
    policies.set(saved.priority, saved);
  }

  for (let index = 0; index < knowledge.length; index += 1) {
    const row = knowledge[index];
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const { application: applicationName, ...knowledgeData } = row;
    const applicationId = applicationIds.get(applicationName);
    if (!applicationId) throw new Error(`Missing seeded application: ${applicationName}`);
    await prisma.knowledgeBase.upsert({
      where: { id },
      update: { ...knowledgeData, applicationId, active: true },
      create: { id, ...knowledgeData, applicationId },
    });
  }

  const now = Date.now();
  for (let index = 0; index < 30; index += 1) {
    const sample = complaints[index % complaints.length];
    const publicId = `SSL-DEMO-${String(index + 1).padStart(4, "0")}`;
    const existing = await prisma.ticket.findUnique({ where: { publicId }, select: { id: true } });
    if (existing) continue;
    const customer = customers[index % customers.length];
    const agent = agents[index % agents.length];
    const policy = policies.get(sample.priority)!;
    const createdAt = new Date(now - (index + 2) * 3_600_000);
    const applicationName = applications[index % applications.length];
    const knowledgeIndex = knowledge.findIndex(
      (entry) =>
        entry.category === sample.category &&
        (entry.application === applicationName || entry.application === "Other"),
    );
    const knowledgeEntry = knowledgeIndex >= 0 ? knowledge[knowledgeIndex] : null;
    const status =
      index % 11 === 0
        ? TicketStatus.CLOSED
        : index % 4 === 0
          ? TicketStatus.RESOLVED
          : index % 7 === 0
            ? TicketStatus.PENDING
            : index % 5 === 0
              ? TicketStatus.WAITING_FOR_CUSTOMER
              : index % 3 === 0
                ? TicketStatus.IN_PROGRESS
                : TicketStatus.ASSIGNED;
    const resolvedAt =
      status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED
        ? new Date(createdAt.getTime() + 40 * 60_000)
        : null;
    const closedAt = status === TicketStatus.CLOSED ? resolvedAt : null;
    const selfServiceResolved =
      status === TicketStatus.RESOLVED && Boolean(knowledgeEntry) && index % 2 === 0;
    const dueAt = new Date(createdAt.getTime() + policy.resolutionMins * 60_000);
    const breached = index === 9 || index === 19;
    await prisma.ticket.create({
      data: {
        publicId,
        applicationId: applicationIds.get(applications[index % applications.length])!,
        subject: sample.subject,
        description: sample.description,
        category: sample.category,
        priority: sample.priority,
        priorityConfidence: 0.6,
        priorityReason: "Seeded synthetic example; AI analysis runs on new complaints.",
        status,
        customerId: customer.id,
        assignedAgentId: agent.id,
        selfServiceResolved,
        resolutionMethod: selfServiceResolved ? "AI_SELF_SERVICE" : null,
        resolvedAt,
        closedAt,
        createdAt,
        analyses: {
          create: {
            confidenceScore: 0.6,
            analysisReason: "Synthetic seeded analysis for database testing.",
            duplicateDetected: index % 6 === 0,
            predictedCategory: sample.category,
            categoryConfidence: 0.6,
            predictedPriority: sample.priority,
            priorityConfidence: 0.6,
            sentiment: "NEGATIVE",
            sentimentScore: -0.4,
            priorityReason: "Synthetic seeded analysis; new tickets use the AI service.",
            duplicateTicketIds: [],
            modelVersion: "synthetic-seed-v1",
          },
        },
        suggestions:
          knowledgeEntry && index % 2 === 0
            ? {
                create: {
                  knowledgeBaseId: `00000000-0000-4000-8000-${String(knowledgeIndex + 1).padStart(12, "0")}`,
                  relevance: 0.65,
                  steps: knowledgeEntry.troubleshooting,
                  recommended: knowledgeEntry.recommended,
                  customerChoice: resolvedAt ? selfServiceResolved : null,
                  customerResponse: selfServiceResolved
                    ? "SOLVED"
                    : resolvedAt
                      ? "NOT_SOLVED"
                      : "PENDING",
                  confirmedAt: resolvedAt,
                },
              }
            : undefined,
        sla: {
          create: {
            policyId: policy.id,
            firstResponseDue: new Date(createdAt.getTime() + policy.firstResponseMins * 60_000),
            resolutionDue: dueAt,
            firstResponseAt: new Date(createdAt.getTime() + 5 * 60_000),
            resolvedAt,
            breachedAt: breached ? dueAt : null,
            state: resolvedAt ? "COMPLETED" : breached ? "BREACHED" : "ON_TRACK",
            responseSlaStatus: breached ? "BREACHED" : "COMPLETED",
            resolutionSlaStatus: resolvedAt ? "COMPLETED" : breached ? "BREACHED" : "ON_TRACK",
          },
        },
        assignments: {
          create: {
            agentId: agent.id,
            assignedById: index % 2 === 0 ? admin.id : undefined,
            assignmentType: index % 2 === 0 ? "MANUAL" : "AUTOMATIC",
            assignmentReason:
              index % 2 === 0
                ? "Synthetic admin assignment."
                : "Synthetic skill and workload match.",
            unassignedAt: resolvedAt,
          },
        },
        escalations: breached
          ? {
              create: {
                type: "BREACH",
                level: 1,
                reason: "Synthetic SLA breach record for demo analytics.",
                status: "OPEN",
                triggeredAt: dueAt,
              },
            }
          : undefined,
        notifications:
          index % 3 === 0
            ? {
                create: {
                  userId: customer.id,
                  type: "TICKET_CREATED",
                  title: "Complaint created",
                  message: `Synthetic complaint ${publicId} was created.`,
                },
              }
            : undefined,
        history: {
          create: [
            { event: "Complaint submitted", createdAt },
            { event: `Assigned to ${agent.name}`, createdAt: new Date(createdAt.getTime() + 30_000) },
            ...(resolvedAt ? [{ event: "Complaint resolved", createdAt: resolvedAt }] : []),
          ],
        },
        messages:
          index % 3 === 0
            ? {
                create: {
                  authorId: agent.id,
                  body: "Thanks for reporting this. Please use the official provider support flow for account-specific checks.",
                  createdAt: new Date(createdAt.getTime() + 10 * 60_000),
                },
              }
            : undefined,
        internalNotes:
          index % 5 === 0
            ? {
                create: {
                  authorId: agent.id,
                  body: "Synthetic staff-only note for the demo. Do not share account credentials.",
                  createdAt: new Date(createdAt.getTime() + 12 * 60_000),
                },
              }
            : undefined,
        feedback:
          resolvedAt && index % 2 === 0
            ? {
                create: {
                  customerId: customer.id,
                  rating: index % 3 === 0 ? 4 : 5,
                  comment: "Thanks for the clear guidance.",
                  createdAt: resolvedAt,
                },
              }
            : undefined,
      },
    });
  }

  const canned = [
    ["Acknowledge complaint", "Thanks for contacting support. I am reviewing the details and will update you here."],
    ["Request more details", "Could you share the steps you followed and the exact message shown? Please remove passwords, OTPs, and payment credentials."],
    ["Official support reminder", "For account-specific payment or refund actions, please contact the application provider or bank through its official support channels."],
  ];
  for (const [title, body] of canned) {
    const exists = await prisma.cannedResponse.findFirst({ where: { title } });
    if (!exists) await prisma.cannedResponse.create({ data: { title, body, authorId: admin.id } });
  }
  console.log("Seed complete: 1 admin, 5 agents, 10 customers, 30 complaints, SLA policies and approved knowledge entries.");
  console.log("Demo account password comes from DEMO_SEED_PASSWORD.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

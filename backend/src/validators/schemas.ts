import { z } from "zod";
import {
  AgentAvailability,
  ComplaintCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(100),
  phoneNumber: z.string().trim().min(7).max(30).optional(),
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(100),
});

export const ticketCreateSchema = z.object({
  application: z.string().trim().min(2).max(80),
  subject: z.string().trim().min(6).max(160),
  description: z.string().trim().min(12).max(4000),
  category: z.nativeEnum(ComplaintCategory).optional(),
});

export const ticketUpdateSchema = z
  .object({
    application: z.string().trim().min(2).max(80).optional(),
    subject: z.string().trim().min(6).max(160).optional(),
    description: z.string().trim().min(12).max(4000).optional(),
    category: z.nativeEnum(ComplaintCategory).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Provide at least one field to update.",
  });

export const ticketStatusSchema = z.object({
  status: z.enum([
    TicketStatus.OPEN,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.PENDING,
    TicketStatus.WAITING_FOR_CUSTOMER,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ]),
});

export const ticketPrioritySchema = z.object({
  priority: z.nativeEnum(TicketPriority),
  reason: z.string().trim().min(3).max(500),
});

export const ticketListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(ComplaintCategory).optional(),
});

export const solutionFeedbackSchema = z.object({
  resolved: z.boolean(),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const assignmentSchema = z.object({
  agentId: z.uuid(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phoneNumber: z.string().trim().min(7).max(30).nullable().optional(),
}).refine((value) => value.name !== undefined || value.phoneNumber !== undefined, {
  message: "Provide at least one profile field to update.",
});

export const agentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(100),
  active: z.boolean().default(true),
  team: z.string().trim().min(2).max(100).default("Customer Support"),
  capacity: z.number().int().min(1).max(100).default(10),
  availability: z.nativeEnum(AgentAvailability).default(AgentAvailability.AVAILABLE),
  skills: z.array(z.nativeEnum(ComplaintCategory)).min(1),
});

export const agentUpdateSchema = agentSchema.partial().omit({ password: true });

export const slaPolicySchema = z.object({
  firstResponseMins: z.number().int().min(1).max(10080),
  resolutionMins: z.number().int().min(1).max(43200),
  warningMins: z.number().int().min(1).max(1440),
});

export const analyzeSchema = z.object({
  application: z.string().trim().min(2).max(80),
  subject: z.string().trim().min(6).max(160),
  description: z.string().trim().min(12).max(4000),
});

export const solutionSearchSchema = z.object({
  application: z.string().trim().min(2).max(80),
  category: z.nativeEnum(ComplaintCategory),
  subject: z.string().trim().min(6).max(160),
  description: z.string().trim().min(12).max(4000),
});

export const aiFeedbackSchema = z.object({
  publicId: z.string().trim().min(1).max(24),
  resolved: z.boolean(),
});

export const solutionFeedbackBodySchema = z.object({
  resolved: z.boolean(),
});

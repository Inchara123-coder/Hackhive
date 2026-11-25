export const roles = ["admin", "agent", "customer"] as const;
export const priorities = ["Urgent", "High", "Medium", "Low"] as const;
export const statuses = ["Open", "In progress", "Pending", "Resolved"] as const;
export const categories = [
  "Technical",
  "Billing",
  "Account",
  "Product",
  "General",
] as const;
export type Role = (typeof roles)[number];
export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];
export type Category = (typeof categories)[number];
export type Person = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};
export type Agent = Person & {
  availability: "Available" | "Busy" | "Offline";
  capacity: number;
  team: string;
};
export type Session = { role: Role; id: string };
export type Message = {
  id: string;
  author: string;
  text: string;
  at: number;
  private?: boolean;
};
export type Ticket = {
  id: string;
  subject: string;
  description: string;
  category: Category;
  priority: Priority;
  reason: string;
  status: Status;
  customerId: string;
  agentId?: string;
  assignment?: "Automatic" | "Manual";
  createdAt: number;
  dueAt: number;
  resolvedAt?: number;
  escalated?: boolean;
  messages: Message[];
  attachments: string[];
  feedback?: { rating: number; text: string };
  history: { text: string; at: number }[];
};
export type Notice = {
  id: string;
  recipient: string;
  ticketId: string;
  text: string;
  at: number;
  read: boolean;
};
export type Template = { id: string; title: string; text: string };
export type Database = {
  tickets: Ticket[];
  agents: Agent[];
  customers: Person[];
  sla: Record<Priority, number>;
  notices: Notice[];
  templates: Template[];
};

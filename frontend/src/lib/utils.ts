import { HOUR } from "./mock-data";
import type { Agent, Priority, Ticket } from "@/types";
export const dateLabel = (value: number) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    value,
  );
export const dateTime = (value: number) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const risk = (ticket: Ticket, now: number) =>
  ticket.status === "Resolved"
    ? ticket.resolvedAt && ticket.resolvedAt > ticket.dueAt
      ? "Missed"
      : "Met"
    : ticket.dueAt <= now
      ? "Breached"
      : ticket.dueAt - now <= 3 * HOUR
        ? "At risk"
        : "On track";
export function countdown(due: number, now: number) {
  const seconds = Math.ceil(Math.abs(due - now) / 1000);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor(seconds / 60) % 60;
  const time = hours
    ? hours + "h " + mins + "m"
    : mins
      ? mins + "m " + (seconds % 60) + "s"
      : seconds + "s";
  return due <= now ? time + " overdue" : time + " left";
}
export const workload = (tickets: Ticket[], id: string) =>
  tickets.filter((t) => t.agentId === id && t.status !== "Resolved").length;
export function recommend(
  agents: Agent[],
  tickets: Ticket[],
  exclude?: string,
) {
  return agents
    .filter(
      (a) =>
        a.id !== exclude &&
        a.active &&
        a.availability === "Available" &&
        workload(tickets, a.id) < a.capacity,
    )
    .sort(
      (a, b) =>
        workload(tickets, a.id) / a.capacity -
        workload(tickets, b.id) / b.capacity,
    )[0];
}
export function detect(text: string): { priority: Priority; reason: string } {
  if (/\b(outage|urgent|breach|production down|critical)\b/i.test(text))
    return {
      priority: "Urgent",
      reason:
        "The wording indicates an outage or immediate operational impact.",
    };
  if (/\b(blocked|failed|cannot|unable|error|broken)\b/i.test(text))
    return {
      priority: "High",
      reason: "The wording indicates a blocked task or a failed operation.",
    };
  if (/\b(question|suggestion|feature request|how do)\b/i.test(text))
    return {
      priority: "Low",
      reason: "The wording suggests a question or a feature request.",
    };
  return {
    priority: "Medium",
    reason: "No immediate disruption was detected in the description.",
  };
}
export function similar(a: string, b: string) {
  const words = (s: string) =>
    new Set(
      (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (w) =>
          w.length > 2 &&
          !["the", "and", "for", "with", "our", "your"].includes(w),
      ),
    );
  const x = words(a),
    y = words(b);
  return (
    x.size > 0 &&
    y.size > 0 &&
    [...x].filter((w) => y.has(w)).length / Math.max(x.size, y.size) >= 0.6
  );
}

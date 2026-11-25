"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { accounts, demoPassword, HOUR, seed } from "./mock-data";
import { detect, recommend } from "./utils";
import type {
  Category,
  Database,
  Role,
  Session,
  Status,
  Ticket,
} from "@/types";

const DATA = "relaydesk.data.v1";
const USER = "relaydesk.session.v1";
const id = () => crypto.randomUUID();
function alert(
  db: Database,
  recipient: string | undefined,
  ticketId: string,
  text: string,
  at = Date.now(),
) {
  if (recipient)
    db.notices.unshift({
      id: id(),
      recipient,
      ticketId,
      text,
      at,
      read: false,
    });
}
function escalate(db: Database, now: number) {
  for (const ticket of db.tickets) {
    if (ticket.status === "Resolved" || ticket.dueAt > now || ticket.escalated)
      continue;
    ticket.escalated = true;
    ticket.history.push({
      text: "SLA breached · automatic escalation (demo)",
      at: now,
    });
    alert(
      db,
      "admin",
      ticket.id,
      ticket.id + " breached its SLA and was escalated.",
      now,
    );
    alert(
      db,
      ticket.agentId,
      ticket.id,
      ticket.id + " breached its SLA and was escalated.",
      now,
    );
  }
}
function useDemoState() {
  const [db, setDb] = useState<Database | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const [toast, setToast] = useState("");
  useEffect(() => {
    // The demo has no password storage; this record only selects a simulated role.
    let initial = seed();
    let user: Session | null = null;
    try {
      const saved = localStorage.getItem(DATA);
      if (saved) initial = JSON.parse(saved);
      const storedUser =
        sessionStorage.getItem(USER) ?? localStorage.getItem(USER);
      if (storedUser) user = JSON.parse(storedUser);
    } catch {
      /* Recover from invalid stored demo data. */
    }
    const today = Date.now();
    escalate(initial, today);
    setDb(initial);
    setSession(user);
    setNow(today);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (db) localStorage.setItem(DATA, JSON.stringify(db));
  }, [db]);
  useEffect(() => {
    if (
      !db?.tickets.some(
        (t) => t.status !== "Resolved" && !t.escalated && t.dueAt <= now,
      )
    )
      return;
    setDb((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      escalate(next, now);
      return next;
    });
  }, [db, now]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  function update(change: (next: Database) => void) {
    setDb((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      change(next);
      return next;
    });
  }
  function login(next: Session, remember = false) {
    localStorage.removeItem(USER);
    sessionStorage.removeItem(USER);
    (remember ? localStorage : sessionStorage).setItem(
      USER,
      JSON.stringify(next),
    );
    setSession(next);
  }
  function signIn(email: string, password: string, remember: boolean) {
    if (password !== demoPassword) return;
    const normalized = email.toLowerCase().trim();
    const agent = db?.agents.find((a) => a.active && a.email === normalized);
    const customer = db?.customers.find(
      (c) => c.active && c.email === normalized,
    );
    const next: Session | undefined =
      normalized === accounts.admin.email
        ? { role: "admin", id: "admin" }
        : agent
          ? { role: "agent", id: agent.id }
          : customer
            ? { role: "customer", id: customer.id }
            : undefined;
    if (next) {
      login(next, remember);
      return next.role;
    }
  }
  function logout() {
    setSession(null);
    setToast("");
    sessionStorage.removeItem(USER);
    localStorage.removeItem(USER);
  }
  function notice(message: string) {
    setToast(message);
  }
  const person =
    session?.role === "admin"
      ? accounts.admin
      : (session?.role === "agent" ? db?.agents : db?.customers)?.find(
          (p) => p.id === session?.id && p.active,
        );
  const tickets = !person
    ? []
    : session?.role === "agent"
      ? (db?.tickets ?? []).filter((t) => t.agentId === session.id)
      : session?.role === "customer"
        ? (db?.tickets ?? [])
            .filter((t) => t.customerId === session.id)
            .map((t) => ({
              ...t,
              messages: t.messages.filter((m) => !m.private),
            }))
        : (db?.tickets ?? []);
  function createTicket(input: {
    subject: string;
    description: string;
    category: Category;
    attachments: string[];
  }) {
    if (!db || session?.role !== "customer" || !person) return;
    const createdAt = Date.now();
    const ticketId =
      "RD-" +
      (Math.max(1128, ...db.tickets.map((t) => Number(t.id.slice(3)))) + 1);
    const { priority, reason } = detect(
      input.subject + " " + input.description,
    );
    const agent = recommend(db.agents, db.tickets);
    const ticket: Ticket = {
      ...input,
      id: ticketId,
      priority,
      reason,
      createdAt,
      dueAt: createdAt + db.sla[priority] * HOUR,
      status: "Open",
      customerId: session.id,
      agentId: agent?.id,
      assignment: agent ? "Automatic" : undefined,
      messages: [],
      history: [
        { text: "Ticket created", at: createdAt },
        {
          text: agent
            ? "Automatically assigned to " + agent.name + " (demo)"
            : "Queued for manual assignment",
          at: createdAt,
        },
      ],
    };
    update((next) => {
      next.tickets.unshift(ticket);
      alert(
        next,
        ticket.customerId,
        ticket.id,
        "Your ticket " + ticket.id + " was created.",
      );
      if (agent) {
        alert(
          next,
          ticket.customerId,
          ticket.id,
          "Your ticket was assigned to " + agent.name + ".",
        );
        alert(next, agent.id, ticket.id, "A new ticket was assigned to you.");
      }
    });
    notice("Ticket " + ticket.id + " created");
    return ticket.id;
  }
  function register(name: string, email: string, remember: boolean) {
    if (
      !db ||
      db.customers.some((p) => p.email.toLowerCase() === email) ||
      db.agents.some((p) => p.email.toLowerCase() === email) ||
      accounts.admin.email === email
    )
      return false;
    const customer = { id: id(), name, email, active: true };
    update((next) => next.customers.push(customer));
    login({ role: "customer", id: customer.id }, remember);
    return true;
  }
  function assign(ticketId: string, agentId: string) {
    if (session?.role !== "admin" || !person) return;
    update((next) => {
      const t = next.tickets.find((t) => t.id === ticketId);
      const a = next.agents.find((a) => a.id === agentId && a.active);
      if (!t || !a || t.agentId === a.id || t.status === "Resolved") return;
      t.agentId = a.id;
      t.assignment = "Manual";
      t.history.push({
        text: "Manually assigned to " + a.name,
        at: Date.now(),
      });
      alert(
        next,
        t.customerId,
        t.id,
        "Your ticket was assigned to " + a.name + ".",
      );
      alert(next, a.id, t.id, "A ticket was assigned to you.");
    });
    notice("Assignment updated");
  }
  function setStatus(ticketId: string, status: Status) {
    if (
      !session ||
      session.role === "customer" ||
      !tickets.some((t) => t.id === ticketId && t.status !== status)
    )
      return;
    update((next) => {
      const t = next.tickets.find((t) => t.id === ticketId)!;
      const at = Date.now();
      t.status = status;
      t.resolvedAt = status === "Resolved" ? at : undefined;
      if (status !== "Resolved") t.feedback = undefined;
      t.history.push({ text: "Status changed to " + status.toLowerCase(), at });
      alert(
        next,
        t.customerId,
        t.id,
        status === "Resolved"
          ? "Your ticket was resolved. You can now leave feedback."
          : "Your ticket status changed to " + status.toLowerCase() + ".",
      );
    });
    notice(status === "Resolved" ? "Ticket resolved" : "Status updated");
  }
  function reply(ticketId: string, text: string, privateNote = false) {
    if (
      !person ||
      !session ||
      (session.role === "customer" && privateNote) ||
      !tickets.some((t) => t.id === ticketId)
    )
      return;
    update((next) => {
      const t = next.tickets.find((t) => t.id === ticketId)!;
      t.messages.push({
        id: id(),
        author: person.name,
        text,
        at: Date.now(),
        private: privateNote,
      });
      if (!privateNote)
        alert(
          next,
          session.role === "customer" ? t.agentId : t.customerId,
          t.id,
          person.name + " replied to " + t.id + ".",
        );
    });
    notice(privateNote ? "Private note added" : "Reply sent");
  }
  function feedback(ticketId: string, rating: number, text: string) {
    if (
      session?.role !== "customer" ||
      rating < 1 ||
      rating > 5 ||
      !tickets.some((t) => t.id === ticketId && t.status === "Resolved")
    )
      return;
    update((next) => {
      next.tickets.find((t) => t.id === ticketId)!.feedback = { rating, text };
    });
    notice("Thanks for your feedback");
  }
  return {
    db,
    session,
    now,
    toast,
    person,
    tickets,
    update,
    login,
    logout,
    signIn,
    register,
    notice,
    createTicket,
    assign,
    setStatus,
    reply,
    feedback,
  };
}
const Store = createContext<ReturnType<typeof useDemoState> | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  return <Store.Provider value={useDemoState()}>{children}</Store.Provider>;
}
export function useDemo() {
  const store = useContext(Store);
  if (!store) throw new Error("DemoProvider is required");
  return store;
}

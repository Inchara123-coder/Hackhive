"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  FileText,
  LockKeyhole,
  MessageSquare,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Avatar,
  Badge,
  Dialog,
  Empty,
  PageTitle,
  Panel,
  SLA,
} from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo-store";
import { dateTime, risk } from "@/lib/utils";
import { statuses, type Role, type Status, type Ticket } from "@/types";

export function TicketDetail({ ticket, role }: { ticket: Ticket; role: Role }) {
  const store = useDemo();
  const { db, now } = store;
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [modal, setModal] = useState<"assign" | "resolve" | null>(null);
  const [agentId, setAgentId] = useState(ticket.agentId ?? "");
  const [rating, setRating] = useState(ticket.feedback?.rating ?? 0);
  const [feedback, setFeedback] = useState(ticket.feedback?.text ?? "");
  const customer = db?.customers.find((p) => p.id === ticket.customerId);
  const agent = db?.agents.find((p) => p.id === ticket.agentId);
  const isStaff = role !== "customer";
  const state = risk(ticket, now);
  const messages = ticket.messages.filter((m) =>
    mode === "note" ? m.private && isStaff : !m.private,
  );
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = (mode === "reply" ? reply : note).trim();
    if (!body) return;
    store.reply(ticket.id, body, mode === "note");
    if (mode === "reply") setReply("");
    else setNote("");
  }
  return (
    <>
      <Link className="back-link" href={"/" + role + "/tickets"}>
        <ArrowLeft size={16} /> Back to tickets
      </Link>
      <PageTitle
        eyebrow={"TICKET #" + ticket.id}
        title={ticket.subject}
        subtitle={ticket.category + " · Created " + dateTime(ticket.createdAt)}
        actions={
          isStaff &&
          ticket.status !== "Resolved" && (
            <button className="btn primary" onClick={() => setModal("resolve")}>
              <Check size={16} /> Resolve Ticket
            </button>
          )
        }
      />
      <div className="detail-grid">
        <div className="section-stack">
          <Panel title="Request description">
            <div className="panel-body">
              <p className="body-copy">{ticket.description}</p>
              {ticket.attachments.length > 0 && (
                <div className="attachments">
                  {ticket.attachments.map((f) => (
                    <span className="attachment" key={f}>
                      <FileText size={16} />
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          <Panel
            title="Conversation"
            subtitle={
              isStaff
                ? "Keep customer replies and internal notes separate."
                : "Follow updates and reply to the support team."
            }
          >
            {isStaff && (
              <div className="tabs">
                <button
                  className={mode === "reply" ? "active" : ""}
                  onClick={() => setMode("reply")}
                >
                  <MessageSquare size={15} /> Customer replies
                </button>
                <button
                  className={mode === "note" ? "active" : ""}
                  onClick={() => setMode("note")}
                >
                  <LockKeyhole size={15} /> Internal notes
                </button>
              </div>
            )}
            <div className="messages">
              {messages.length ? (
                messages.map((m) => (
                  <div
                    className={"message " + (m.private ? "private" : "")}
                    key={m.id}
                  >
                    <Avatar name={m.author} index={m.private ? 2 : 0} />
                    <div>
                      <div className="message-meta">
                        <strong>{m.author}</strong>
                        <small>{dateTime(m.at)}</small>
                        {m.private && (
                          <span className="badge orange">Private</span>
                        )}
                      </div>
                      <p>{m.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  text={
                    mode === "note"
                      ? "No internal notes yet."
                      : "No replies yet."
                  }
                />
              )}
            </div>
            <form className="form-stack composer" onSubmit={send}>
              {mode === "note" && (
                <div className="callout orange">
                  <LockKeyhole size={17} />
                  <div>
                    <strong>Staff only</strong>
                    <p>Customers cannot see internal notes.</p>
                  </div>
                </div>
              )}
              <label>
                {mode === "note" ? "Write a private note" : "Write a reply"}
                <textarea
                  required
                  rows={3}
                  maxLength={4000}
                  placeholder={
                    mode === "note"
                      ? "Add context for other staff members…"
                      : "Write your message…"
                  }
                  value={mode === "note" ? note : reply}
                  onChange={(e) =>
                    mode === "note"
                      ? setNote(e.target.value)
                      : setReply(e.target.value)
                  }
                />
              </label>
              <div className="composer-actions">
                {isStaff && mode === "reply" && (
                  <select
                    aria-label="Canned response"
                    value=""
                    onChange={(e) => {
                      const template = db?.templates.find(
                        (t) => t.id === e.target.value,
                      );
                      if (template)
                        setReply((current) =>
                          current
                            ? current + "\n\n" + template.text
                            : template.text,
                        );
                    }}
                  >
                    <option value="">Insert canned response</option>
                    {db?.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="btn primary"
                  disabled={!(mode === "note" ? note : reply).trim()}
                >
                  {mode === "note" ? (
                    <LockKeyhole size={15} />
                  ) : (
                    <Send size={15} />
                  )}{" "}
                  {mode === "note" ? "Save private note" : "Send reply"}
                </button>
              </div>
            </form>
          </Panel>
          {role === "customer" && ticket.status === "Resolved" && (
            <Panel
              title="How was your support experience?"
              subtitle="Give us a rating from one to five stars."
            >
              <form
                className="form-stack panel-body"
                onSubmit={(e) => {
                  e.preventDefault();
                  store.feedback(ticket.id, rating, feedback.trim());
                }}
              >
                <div
                  className="stars"
                  role="group"
                  aria-label="Satisfaction rating"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      aria-label={n + (n === 1 ? " star" : " stars")}
                      aria-pressed={rating === n}
                      onClick={() => setRating(n)}
                    >
                      <Star
                        size={27}
                        fill={n <= rating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
                <label>
                  Feedback (optional)
                  <textarea
                    rows={3}
                    value={feedback}
                    maxLength={1500}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </label>
                <button className="btn primary" disabled={!rating}>
                  {ticket.feedback ? "Update feedback" : "Submit feedback"}
                </button>
              </form>
            </Panel>
          )}
        </div>
        <aside className="section-stack">
          <Panel title="Ticket details">
            <div className="panel-body form-stack">
              <div className="data-row">
                <span>Status</span>
                <Badge dot>{ticket.status}</Badge>
              </div>
              {isStaff && (
                <label>
                  Change status
                  <select
                    aria-label="Change status"
                    value={ticket.status}
                    onChange={(e) =>
                      e.target.value === "Resolved"
                        ? setModal("resolve")
                        : store.setStatus(ticket.id, e.target.value as Status)
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="data-row">
                <span>Priority</span>
                <Badge dot>{ticket.priority}</Badge>
              </div>
              <div className="callout purple">
                <Sparkles size={17} />
                <div>
                  <strong>Priority reason · demo</strong>
                  <p>{ticket.reason}</p>
                </div>
              </div>
              <div className="data-row">
                <span>SLA deadline</span>
                <SLA ticket={ticket} now={now} withDate />
              </div>
              {["Breached", "At risk"].includes(state) && (
                <div
                  className={
                    "callout " + (state === "Breached" ? "red" : "orange")
                  }
                >
                  <CircleAlert size={17} />
                  <div>
                    <strong>
                      {state === "Breached"
                        ? "SLA breached"
                        : "SLA deadline approaching"}
                    </strong>
                    <p>
                      {state === "Breached"
                        ? ticket.escalated
                          ? "Escalated in the demo workspace."
                          : "This ticket is past its deadline."
                        : "This ticket is due within three hours."}
                    </p>
                  </div>
                </div>
              )}
              <div className="data-row">
                <span>Assigned agent</span>
                <strong>{agent?.name ?? "Unassigned"}</strong>
              </div>
              <div className="data-row">
                <span>Assignment</span>
                <strong>
                  {ticket.assignment === "Automatic"
                    ? "Automatic · demo"
                    : (ticket.assignment ?? "Queued")}
                </strong>
              </div>
              {role === "admin" && ticket.status !== "Resolved" && (
                <button
                  className="btn full"
                  onClick={() => {
                    setAgentId(ticket.agentId ?? "");
                    setModal("assign");
                  }}
                >
                  {agent ? "Reassign ticket" : "Assign ticket"}
                </button>
              )}
            </div>
          </Panel>
          {isStaff && (
            <Panel title="Customer information">
              <div className="panel-body person-cell">
                <Avatar name={customer?.name ?? "Unknown"} />
                <span>
                  <strong>{customer?.name ?? "Unknown"}</strong>
                  <br />
                  <small className="muted">{customer?.email}</small>
                </span>
              </div>
            </Panel>
          )}
          <Panel title="Ticket history">
            <ol className="timeline">
              {ticket.history.map((event, i) => (
                <li key={i}>
                  <strong>{event.text}</strong>
                  <small>{dateTime(event.at)}</small>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
      {modal === "resolve" && (
        <Dialog title="Resolve this ticket?" close={() => setModal(null)}>
          <p className="muted">
            The customer will receive a demo notification and can leave a
            satisfaction rating.
          </p>
          <div className="form-actions">
            <button className="btn" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                store.setStatus(ticket.id, "Resolved");
                setModal(null);
              }}
            >
              Confirm resolution
            </button>
          </div>
        </Dialog>
      )}
      {modal === "assign" && (
        <Dialog title="Assign a support agent" close={() => setModal(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              store.assign(ticket.id, agentId);
              setModal(null);
            }}
          >
            <label>
              Support agent
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Choose an agent</option>
                {db?.agents
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.availability}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!agentId || agentId === ticket.agentId}
              >
                Save assignment
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

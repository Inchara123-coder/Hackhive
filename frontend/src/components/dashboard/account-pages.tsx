"use client";

import Link from "next/link";
import { Bell, ChevronRight, Clipboard, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  Dialog,
  Empty,
  PageTitle,
  Panel,
} from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo-store";
import { dateTime } from "@/lib/utils";
import type { Role, Template } from "@/types";

export function NotificationList({
  role,
  close,
}: {
  role: Role;
  close?: () => void;
}) {
  const { db, session, tickets, update } = useDemo();
  const notices = db?.notices.filter((n) => n.recipient === session?.id) ?? [];
  return (
    <>
      <div className="notification-controls">
        <small>{notices.filter((n) => !n.read).length} unread</small>
        <button
          className="text-btn"
          disabled={!notices.some((n) => !n.read)}
          onClick={() =>
            update((next) =>
              next.notices.forEach((n) => {
                if (n.recipient === session?.id) n.read = true;
              }),
            )
          }
        >
          Mark all as read
        </button>
      </div>
      {notices.length ? (
        <div className="list-stack notice-list">
          {notices.map((n) => {
            const mark = () =>
              update((next) => {
                const found = next.notices.find((x) => x.id === n.id);
                if (found) found.read = true;
              });
            const content = (
              <>
                <span className="stat-icon purple">
                  <Bell size={16} />
                </span>
                <span>
                  <strong>{n.text}</strong>
                  <small>{dateTime(n.at)}</small>
                </span>
                {!n.read && <i className="unread" />}
              </>
            );
            return tickets.some((t) => t.id === n.ticketId) ? (
              <Link
                href={"/" + role + "/tickets/" + n.ticketId}
                className="notification-row"
                key={n.id}
                onClick={() => {
                  mark();
                  close?.();
                }}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                className="notification-row"
                key={n.id}
                onClick={mark}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty text="You’re all caught up." />
      )}
    </>
  );
}
export function Notifications({ role }: { role: Role }) {
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="Notifications"
        subtitle="Stay up to date with activity in your support workspace."
      />
      <Panel title="Inbox">
        <NotificationList role={role} />
      </Panel>
    </>
  );
}
export function Profile() {
  const { session, person, update, notice } = useDemo();
  if (!session || !person) return null;
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="My profile"
        subtitle="Manage your display name and view your account details."
      />
      <Panel title="Personal information" className="narrow-panel">
        <form
          className="panel-body form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(
              new FormData(e.currentTarget).get("name"),
            ).trim();
            if (name.length < 2) {
              notice("Enter at least two characters for your name");
              return;
            }
            update((next) => {
              const p = (
                session.role === "agent" ? next.agents : next.customers
              ).find((p) => p.id === session.id);
              if (p) p.name = name;
            });
            notice("Profile updated");
          }}
        >
          <div className="person-cell">
            <Avatar name={person.name} />
            <strong>{person.name}</strong>
          </div>
          <label>
            Display name
            <input
              name="name"
              required
              minLength={2}
              maxLength={70}
              defaultValue={person.name}
            />
          </label>
          <label>
            Email address
            <input readOnly value={person.email} />
          </label>
          <button className="btn primary">Save profile</button>
        </form>
      </Panel>
    </>
  );
}
export function Notes() {
  const { tickets } = useDemo();
  const notes = tickets
    .flatMap((t) => t.messages.filter((m) => m.private).map((m) => ({ t, m })))
    .sort((a, b) => b.m.at - a.m.at);
  return (
    <>
      <PageTitle
        eyebrow="AGENT WORKSPACE"
        title="Internal Notes"
        subtitle="Private notes for tickets currently assigned to you."
        actions={
          <Link className="btn" href="/agent/tickets">
            Open assigned tickets
          </Link>
        }
      />
      <Panel title="Recent notes" subtitle="Visible only to staff in the demo">
        {notes.length ? (
          <div className="list-stack">
            {notes.map(({ t, m }) => (
              <Link
                href={"/agent/tickets/" + t.id}
                className="list-row"
                key={m.id}
              >
                <span>
                  <small>
                    #{t.id} · {m.author} · {dateTime(m.at)}
                  </small>
                  <strong>{t.subject}</strong>
                  <span>{m.text}</span>
                </span>
                <ChevronRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty text="No private notes on your assigned tickets." />
        )}
      </Panel>
    </>
  );
}
export function CannedResponses() {
  const { db, update, notice } = useDemo();
  const [editor, setEditor] = useState<Template>();
  const [remove, setRemove] = useState<Template>();
  const [error, setError] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="AGENT WORKSPACE"
        title="Canned Responses"
        subtitle="Manage reusable messages you can insert into customer replies."
        actions={
          <button
            className="btn primary"
            onClick={() => {
              setError("");
              setEditor({ id: "", title: "", text: "" });
            }}
          >
            <Plus size={16} /> Add response
          </button>
        }
      />
      <div className="split-grid">
        {db?.templates.map((t) => (
          <Panel key={t.id} title={t.title}>
            <div className="panel-body form-stack">
              <p className="body-copy">{t.text}</p>
              <div className="button-row">
                <button
                  className="btn small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(t.text);
                      notice("Response copied");
                    } catch {
                      setError(
                        "Clipboard access is unavailable. You can select and copy the response text.",
                      );
                    }
                  }}
                >
                  <Clipboard size={14} /> Copy
                </button>
                <button
                  className="btn small"
                  onClick={() => {
                    setError("");
                    setEditor(t);
                  }}
                >
                  Edit
                </button>
                <button
                  className="icon-btn"
                  aria-label={"Delete " + t.title}
                  onClick={() => setRemove(t)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      {!db?.templates.length && (
        <Panel title="Responses">
          <Empty text="Add a response to start your library." />
        </Panel>
      )}
      {error && !editor && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {editor && (
        <Dialog
          title={editor.id ? "Edit response" : "Add response"}
          close={() => setEditor(undefined)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editor.title.trim() || !editor.text.trim())
                return setError("Enter a title and response.");
              const item = {
                id: editor.id || crypto.randomUUID(),
                title: editor.title.trim(),
                text: editor.text.trim(),
              };
              update((next) => {
                next.templates = editor.id
                  ? next.templates.map((t) => (t.id === item.id ? item : t))
                  : [...next.templates, item];
              });
              setEditor(undefined);
              notice("Response saved");
            }}
          >
            <label>
              Title
              <input
                required
                maxLength={80}
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
              />
            </label>
            <label>
              Response
              <textarea
                required
                maxLength={2000}
                rows={5}
                value={editor.text}
                onChange={(e) => setEditor({ ...editor, text: e.target.value })}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary">Save response</button>
          </form>
        </Dialog>
      )}
      {remove && (
        <Dialog
          title="Delete this response?"
          close={() => setRemove(undefined)}
        >
          <p className="muted">
            {remove.title} will be removed from the response library.
          </p>
          <div className="form-actions">
            <button className="btn" onClick={() => setRemove(undefined)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                update((next) => {
                  next.templates = next.templates.filter(
                    (t) => t.id !== remove.id,
                  );
                });
                setRemove(undefined);
                notice("Response deleted");
              }}
            >
              Delete response
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

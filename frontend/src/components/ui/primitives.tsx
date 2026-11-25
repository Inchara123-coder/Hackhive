"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clock3,
  Inbox,
  LifeBuoy,
  X,
  type LucideIcon,
} from "lucide-react";
import { countdown, dateTime, initials, risk } from "@/lib/utils";
import type { Ticket } from "@/types";

export const tone = (value: string) =>
  ({
    Urgent: "red",
    High: "orange",
    Medium: "blue",
    Low: "gray",
    Open: "blue",
    "In progress": "purple",
    Pending: "orange",
    Resolved: "green",
    Available: "green",
    Busy: "orange",
    Offline: "gray",
    "At risk": "orange",
    Breached: "red",
    Missed: "red",
    Met: "green",
    "On track": "green",
  })[value] ?? "gray";

export function Badge({
  children,
  dot = false,
}: {
  children: string;
  dot?: boolean;
}) {
  return (
    <span className={"badge " + tone(children)}>
      {dot && <i />}
      {children}
    </span>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span>
        <LifeBuoy size={22} strokeWidth={2.3} />
      </span>
      <strong>
        RelayDesk<span>.</span>
      </strong>
    </div>
  );
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span aria-hidden="true" className={"avatar avatar-" + (index % 5)}>
      {initials(name)}
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="title-actions">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function Stat({
  title,
  value,
  icon: Icon,
  color,
  hint,
  trend,
}: {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  color: string;
  hint: string;
  trend?: "up" | "down";
}) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span>{title}</span>
        <span className={"stat-icon " + color}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">
        {trend === "up" ? (
          <ArrowUpRight size={14} />
        ) : trend === "down" ? (
          <ArrowDownRight size={14} />
        ) : null}
        {hint}
      </div>
    </article>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Inbox size={26} />
      <p>{text}</p>
    </div>
  );
}
export function SLA({
  ticket,
  now,
  withDate = false,
}: {
  ticket: Ticket;
  now: number;
  withDate?: boolean;
}) {
  const state = risk(ticket, now);
  return (
    <div className="sla">
      <span className={tone(state)}>
        <Clock3 size={13} />
        {ticket.status === "Resolved"
          ? "SLA " + state.toLowerCase()
          : countdown(ticket.dueAt, now)}
      </span>
      {withDate && <small>Due {dateTime(ticket.dueAt)}</small>}
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div className="toast" role="status">
      <span className="stat-icon green">
        <Check size={17} />
      </span>
      {message}
    </div>
  ) : null;
}

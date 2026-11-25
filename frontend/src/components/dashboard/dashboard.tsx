"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Headphones,
  Hourglass,
  Inbox,
  Plus,
  Star,
  TicketCheck,
  Zap,
} from "lucide-react";
import {
  CategoryChart,
  ComplianceChart,
  PriorityChart,
  TicketActivity,
  WorkloadChart,
} from "@/components/charts/ticket-charts";
import { TicketTable } from "@/components/tickets/ticket-table";
import {
  Avatar,
  Badge,
  Empty,
  PageTitle,
  Panel,
  SLA,
  Stat,
} from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo-store";
import { DAY, HOUR } from "@/lib/mock-data";
import { risk, workload } from "@/lib/utils";
import type { Role, Ticket } from "@/types";

export function metrics(tickets: Ticket[], now: number) {
  const done = tickets.filter((t) => t.resolvedAt && t.resolvedAt <= now);
  const rated = done.filter((t) => t.feedback);
  return {
    done,
    met: done.filter((t) => t.resolvedAt! <= t.dueAt).length,
    breached: tickets.filter((t) => risk(t, now) === "Breached").length,
    avg: done.length
      ? (
          done.reduce((acc, t) => acc + (t.resolvedAt! - t.createdAt), 0) /
          done.length /
          HOUR
        ).toFixed(1) + "h"
      : "—",
    csat: rated.length
      ? (
          rated.reduce((acc, t) => acc + t.feedback!.rating, 0) / rated.length
        ).toFixed(1) + "/5"
      : "—",
    week: tickets.filter((t) => t.createdAt >= now - 7 * DAY).length,
  };
}
export function Performance({ agentId }: { agentId?: string }) {
  const { db, now } = useDemo();
  if (!db) return null;
  const agents = agentId
    ? db.agents.filter((a) => a.id === agentId)
    : db.agents;
  return (
    <Panel
      title={agentId ? "My workload and performance" : "Agent performance"}
      subtitle="Live workload and resolution metrics in the demo"
      actions={
        !agentId && (
          <Link className="btn small" href="/admin/agents">
            Manage agents <ArrowRight size={14} />
          </Link>
        )
      }
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Availability</th>
              <th>Active / capacity</th>
              <th>Resolved</th>
              <th>Avg. resolution</th>
              <th>CSAT</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => {
              const load = workload(db.tickets, a.id);
              const m = metrics(
                db.tickets.filter((t) => t.agentId === a.id),
                now,
              );
              return (
                <tr key={a.id}>
                  <td>
                    <span className="person-cell">
                      <Avatar name={a.name} index={i} />
                      <strong>{a.name}</strong>
                    </span>
                  </td>
                  <td>
                    <Badge dot>{a.active ? a.availability : "Inactive"}</Badge>
                  </td>
                  <td>
                    <div className="load-cell">
                      <div className="progress">
                        <span
                          className={load >= a.capacity ? "overload" : ""}
                          style={{
                            width:
                              Math.min((load / a.capacity) * 100, 100) + "%",
                          }}
                        />
                      </div>
                      {load}/{a.capacity}
                    </div>
                  </td>
                  <td>{m.done.length}</td>
                  <td>{m.avg}</td>
                  <td>{m.csat}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
function RiskPanel({ tickets }: { tickets: Ticket[] }) {
  const { now } = useDemo();
  const atRisk = tickets
    .filter((t) => ["At risk", "Breached"].includes(risk(t, now)))
    .sort((a, b) => a.dueAt - b.dueAt);
  const overdue = atRisk.filter((t) => risk(t, now) === "Breached");
  const approaching = atRisk.filter((t) => risk(t, now) === "At risk");
  const watch =
    overdue.length && approaching.length
      ? [
          ...overdue.slice(0, 1),
          ...approaching.slice(0, 2),
          ...overdue.slice(1),
        ].slice(0, 3)
      : atRisk.slice(0, 3);
  return (
    <Panel
      title="SLA watchlist"
      subtitle="Tickets that need your attention"
      actions={
        <span className="watch-icon">
          <Zap size={18} />
        </span>
      }
    >
      <div className="watch-list">
        {watch.length ? (
          watch.map((t) => (
            <Link
              key={t.id}
              href={"/admin/tickets/" + t.id}
              className="watch-row"
            >
              <span
                className={
                  "alert-square " +
                  (risk(t, now) === "Breached" ? "red" : "orange")
                }
              >
                <Clock3 size={16} />
              </span>
              <span>
                <small>#{t.id}</small>
                <strong>{t.subject}</strong>
                <SLA ticket={t} now={now} />
              </span>
              <ChevronRight size={15} />
            </Link>
          ))
        ) : (
          <Empty text="All active tickets are on track." />
        )}
      </div>
      <div className="panel-footer">
        <Link className="btn full rescue-link" href="/admin/sla-rescue">
          <Zap size={15} /> Open SLA Rescue Mode <ArrowRight size={15} />
        </Link>
      </div>
    </Panel>
  );
}
export function AdminDashboard({ analytics = false }: { analytics?: boolean }) {
  const { db, tickets, now } = useDemo();
  if (!db) return null;
  const m = metrics(tickets, now);
  return (
    <>
      <PageTitle
        eyebrow={analytics ? "WORKSPACE INSIGHTS" : "SUPPORT OPERATIONS"}
        title={analytics ? "Reports & Analytics" : "Dashboard Overview"}
        subtitle={
          analytics
            ? "Explore ticket trends, agent workload, and service performance."
            : "Here’s what’s happening with your support operations today."
        }
        actions={
          analytics ? (
            <Link className="btn" href="/admin/dashboard">
              Back to overview
            </Link>
          ) : (
            <>
              <Link href="/admin/analytics" className="btn">
                <ChartIcon /> View reports
              </Link>
              <Link href="/admin/sla-rescue" className="btn primary">
                <Zap size={16} /> SLA Rescue Mode
              </Link>
            </>
          )
        }
      />
      {!analytics && (
        <div className="stats-grid">
          <Stat
            title="Total tickets"
            value={tickets.length}
            icon={Inbox}
            color="purple"
            hint={m.week + " created in the past 7 days"}
            trend="up"
          />
          <Stat
            title="Open tickets"
            value={
              tickets.filter((t) => ["Open", "In progress"].includes(t.status))
                .length
            }
            icon={TicketCheck}
            color="blue"
            hint="Open and in progress"
          />
          <Stat
            title="Pending tickets"
            value={tickets.filter((t) => t.status === "Pending").length}
            icon={Hourglass}
            color="orange"
            hint="Awaiting a response"
          />
          <Stat
            title="Resolved tickets"
            value={m.done.length}
            icon={CheckCircle2}
            color="green"
            hint={m.met + " resolved within SLA"}
          />
        </div>
      )}
      <div className={analytics ? "split-grid" : "overview-grid"}>
        <TicketActivity tickets={tickets} now={now} />
        <PriorityChart tickets={tickets} />
      </div>
      {!analytics && (
        <div className="overview-grid queue-grid">
          <TicketTable tickets={tickets} role="admin" compact />
          <RiskPanel tickets={tickets} />
        </div>
      )}
      <div className="stats-grid three">
        <Stat
          title="SLA breaches"
          value={m.breached}
          icon={CircleAlert}
          color="red"
          hint="Active tickets past their deadline"
        />
        <Stat
          title="Average resolution time"
          value={m.avg}
          icon={Clock3}
          color="purple"
          hint="Across resolved tickets"
        />
        <Stat
          title="Customer satisfaction"
          value={m.csat}
          icon={Star}
          color="orange"
          hint="Based on submitted ratings"
        />
      </div>
      <div className="split-grid">
        <CategoryChart tickets={tickets} />
        <WorkloadChart tickets={tickets} agents={db.agents} />
      </div>
      <div className="split-grid">
        <ComplianceChart met={m.met} total={m.done.length} />
        <Panel
          title="Urgent tickets"
          subtitle="Open requests with the highest priority"
        >
          {tickets.filter(
            (t) => t.priority === "Urgent" && t.status !== "Resolved",
          ).length ? (
            <div className="list-stack">
              {tickets
                .filter(
                  (t) => t.priority === "Urgent" && t.status !== "Resolved",
                )
                .slice(0, 5)
                .map((t) => (
                  <Link
                    key={t.id}
                    className="list-row"
                    href={"/admin/tickets/" + t.id}
                  >
                    <span>
                      <small>#{t.id}</small>
                      <strong>{t.subject}</strong>
                    </span>
                    <SLA ticket={t} now={now} />
                  </Link>
                ))}
            </div>
          ) : (
            <Empty text="No urgent tickets are open." />
          )}
        </Panel>
      </div>
      <Performance />
    </>
  );
}
function ChartIcon() {
  return (
    <span className="chart-button-icon" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
export function PersonalDashboard({ role }: { role: Exclude<Role, "admin"> }) {
  const { tickets, person, now } = useDemo();
  const agent = role === "agent";
  const done = tickets.filter((t) => t.status === "Resolved").length;
  return (
    <>
      <PageTitle
        eyebrow={agent ? "AGENT WORKSPACE" : "CUSTOMER PORTAL"}
        title={
          agent
            ? "My Dashboard"
            : "Welcome, " + person?.name.split(" ")[0] + "!"
        }
        subtitle={
          agent
            ? "Manage your queue and keep customer requests moving."
            : "Create requests, follow updates, and get help from our support team."
        }
        actions={
          agent ? (
            <Link className="btn primary" href="/agent/tickets">
              <Inbox size={16} /> Open assigned tickets
            </Link>
          ) : (
            <Link className="btn primary" href="/customer/create-ticket">
              <Plus size={18} /> Create New Ticket
            </Link>
          )
        }
      />
      <div className={"stats-grid " + (agent ? "" : "three")}>
        <Stat
          title={agent ? "My assigned tickets" : "Total tickets"}
          value={tickets.length}
          icon={agent ? Headphones : Inbox}
          color="purple"
          hint={agent ? "Across all statuses" : "All your support requests"}
        />
        <Stat
          title={agent ? "Urgent tickets" : "Open tickets"}
          value={
            tickets.filter(
              (t) =>
                t.status !== "Resolved" &&
                (agent
                  ? t.priority === "Urgent"
                  : ["Open", "In progress"].includes(t.status)),
            ).length
          }
          icon={agent ? CircleAlert : TicketCheck}
          color={agent ? "red" : "blue"}
          hint={agent ? "Priority items in your queue" : "Open and in progress"}
        />
        {agent && (
          <Stat
            title="Pending tickets"
            value={tickets.filter((t) => t.status === "Pending").length}
            icon={Hourglass}
            color="orange"
            hint="Awaiting a response"
          />
        )}
        <Stat
          title="Resolved tickets"
          value={done}
          icon={CheckCircle2}
          color="green"
          hint="Completed support requests"
        />
      </div>
      <TicketTable tickets={tickets} role={role} compact />
      {agent && (
        <>
          <Performance agentId={person?.id} />
          <TicketActivity tickets={tickets} now={now} />
        </>
      )}
    </>
  );
}

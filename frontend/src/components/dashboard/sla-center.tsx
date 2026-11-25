"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, Clock3, Users, Zap } from "lucide-react";
import { useState } from "react";
import { useDemo } from "@/lib/demo-store";
import { recommend, risk, workload } from "@/lib/utils";
import {
  Badge,
  Dialog,
  Empty,
  PageTitle,
  Panel,
  SLA,
  Stat,
} from "@/components/ui/primitives";
import { ComplianceChart } from "@/components/charts/ticket-charts";
import { metrics } from "./dashboard";

export function SLACenter({ rescue }: { rescue: boolean }) {
  const { db, now, assign, update, notice } = useDemo();
  const [selected, setSelected] = useState<{ id: string; agentId?: string }>();
  if (!db) return null;
  const active = db.tickets.filter((t) => t.status !== "Resolved");
  const near = active.filter((t) => risk(t, now) === "At risk");
  const breached = active.filter((t) => risk(t, now) === "Breached");
  const overloaded = db.agents.filter(
    (a) => a.active && workload(active, a.id) > a.capacity,
  );
  const items = [...breached, ...near].sort((a, b) => a.dueAt - b.dueAt);
  const m = metrics(db.tickets, now);
  return (
    <>
      <PageTitle
        eyebrow="SERVICE LEVEL AGREEMENTS"
        title={rescue ? "SLA Rescue Mode" : "SLA Monitoring"}
        subtitle={
          rescue
            ? "Prioritize overdue requests, rebalance workload, and intervene before the next breach."
            : "Track active deadlines and see how consistently your team meets its commitments."
        }
        actions={
          <Link
            className={"btn " + (rescue ? "" : "primary")}
            href={rescue ? "/admin/sla-monitoring" : "/admin/sla-rescue"}
          >
            {rescue ? <Clock3 size={16} /> : <Zap size={16} />}{" "}
            {rescue ? "SLA monitoring" : "Open Rescue Mode"}
          </Link>
        }
      />
      <div className="stats-grid three">
        <Stat
          title="Approaching deadline"
          value={near.length}
          icon={Clock3}
          color="orange"
          hint="Due within three hours"
        />
        <Stat
          title="Breached SLA"
          value={breached.length}
          icon={CircleAlert}
          color="red"
          hint="Active and past deadline"
        />
        <Stat
          title={rescue ? "Overloaded agents" : "On track"}
          value={rescue ? overloaded.length : active.length - items.length}
          icon={rescue ? Users : Clock3}
          color="purple"
          hint={
            rescue
              ? "Above active ticket capacity"
              : "More than three hours remaining"
          }
        />
      </div>
      {!rescue && (
        <div className="split-grid">
          <ComplianceChart met={m.met} total={m.done.length} />
          <Panel
            title="SLA targets"
            subtitle="Resolution limits for newly submitted tickets"
          >
            <div className="panel-body form-stack">
              {Object.entries(db.sla).map(([p, h]) => (
                <div key={p} className="data-row">
                  <Badge>{p}</Badge>
                  <strong>{h} hours</strong>
                </div>
              ))}
              <Link className="btn" href="/admin/settings">
                Edit SLA targets <ArrowRight size={15} />
              </Link>
            </div>
          </Panel>
        </div>
      )}
      <Panel
        title={rescue ? "Rescue queue" : "Deadline watchlist"}
        subtitle={
          rescue
            ? "Recommendations are calculated from current demo workloads."
            : "At risk and overdue tickets, ordered by deadline."
        }
      >
        {items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Current agent</th>
                  <th>SLA</th>
                  {rescue && <th>Recommended action</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const current = db.agents.find((a) => a.id === t.agentId);
                  const replacement =
                    !current ||
                    current.availability !== "Available" ||
                    !current.active ||
                    workload(active, current.id) > current.capacity
                      ? recommend(db.agents, active, current?.id)
                      : undefined;
                  const status = risk(t, now);
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link
                          className="ticket-link"
                          href={"/admin/tickets/" + t.id}
                        >
                          <small>#{t.id}</small>
                          <strong>{t.subject}</strong>
                        </Link>
                      </td>
                      <td>{current?.name ?? "Unassigned"}</td>
                      <td>
                        <SLA ticket={t} now={now} withDate />
                      </td>
                      {rescue && (
                        <td>
                          <div className="rescue-actions">
                            {replacement && (
                              <button
                                className="btn small"
                                onClick={() =>
                                  setSelected({
                                    id: t.id,
                                    agentId: replacement.id,
                                  })
                                }
                              >
                                Reassign to {replacement.name.split(" ")[0]}
                              </button>
                            )}
                            {t.escalated ? (
                              <>
                                <Badge dot>{status}</Badge>
                                <Link
                                  className="btn small"
                                  href={"/admin/tickets/" + t.id}
                                >
                                  Review escalation <ArrowRight size={13} />
                                </Link>
                              </>
                            ) : (
                              !replacement && (
                                <button
                                  className="btn small"
                                  onClick={() => setSelected({ id: t.id })}
                                >
                                  Escalate for review
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="There are no at risk or overdue tickets." />
        )}
      </Panel>
      {rescue && (
        <Panel
          title="Overloaded agents"
          subtitle="Review these queues to free up capacity."
        >
          {overloaded.length ? (
            <div className="list-stack">
              {overloaded.map((a) => (
                <div className="list-row" key={a.id}>
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.team} · {workload(active, a.id)} / {a.capacity} active
                    </small>
                  </span>
                  <Link className="btn small" href="/admin/agents">
                    View workload
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No agents are above capacity." />
          )}
        </Panel>
      )}
      {selected && (
        <Dialog
          title={
            selected.agentId
              ? "Confirm recommended reassignment"
              : "Escalate ticket?"
          }
          close={() => setSelected(undefined)}
        >
          <p className="muted">
            {selected.id}{" "}
            {selected.agentId
              ? "will be reassigned to " +
                db.agents.find((a) => a.id === selected.agentId)?.name +
                "."
              : "will be flagged for staff review."}
          </p>
          <div className="form-actions">
            <button className="btn" onClick={() => setSelected(undefined)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                if (selected.agentId) assign(selected.id, selected.agentId);
                else {
                  update((next) => {
                    const t = next.tickets.find((t) => t.id === selected.id);
                    if (t && !t.escalated) {
                      t.escalated = true;
                      t.history.push({
                        text: "Escalated for staff review",
                        at: Date.now(),
                      });
                    }
                  });
                  notice("Ticket escalated");
                }
                setSelected(undefined);
              }}
            >
              Confirm
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

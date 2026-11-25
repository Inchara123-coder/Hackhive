"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpDown, Search } from "lucide-react";
import { useState } from "react";
import { useDemo } from "@/lib/demo-store";
import { dateTime } from "@/lib/utils";
import {
  categories,
  priorities,
  statuses,
  type Role,
  type Ticket,
} from "@/types";
import { Avatar, Badge, Empty, Panel, SLA } from "@/components/ui/primitives";

export function TicketTable({
  tickets,
  role,
  compact = false,
  focusSearch = false,
}: {
  tickets: Ticket[];
  role: Role;
  compact?: boolean;
  focusSearch?: boolean;
}) {
  const { db, now } = useDemo();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<{
    key: "createdAt" | "priority" | "subject" | "dueAt";
    desc: boolean;
  }>({ key: "createdAt", desc: true });
  const [page, setPage] = useState(1);
  const matching = (
    compact
      ? tickets
      : tickets.filter(
          (t) =>
            (!status || t.status === status) &&
            (!priority || t.priority === priority) &&
            (!category || t.category === category) &&
            [
              t.id,
              t.subject,
              t.category,
              db?.customers.find((c) => c.id === t.customerId)?.name,
            ].some((s) =>
              s?.toLowerCase().includes(search.trim().toLowerCase()),
            ),
        )
  )
    .slice()
    .sort((a, b) => {
      const diff =
        sort.key === "priority"
          ? priorities.indexOf(b.priority) - priorities.indexOf(a.priority)
          : sort.key === "subject"
            ? a.subject.localeCompare(b.subject)
            : a[sort.key] - b[sort.key];
      return diff * (sort.desc ? -1 : 1);
    });
  const size = compact ? 5 : 12;
  const pages = Math.max(1, Math.ceil(matching.length / size));
  const current = Math.min(page, pages);
  const visible = matching.slice((current - 1) * size, current * size);
  function sortBy(key: typeof sort.key) {
    setSort({
      key,
      desc:
        sort.key === key
          ? !sort.desc
          : key === "createdAt" || key === "priority",
    });
    setPage(1);
  }
  const sortIcon = (key: typeof sort.key) =>
    sort.key === key ? (
      <ArrowDown className={sort.desc ? "" : "rotate-180"} size={12} />
    ) : (
      <ArrowUpDown size={12} />
    );
  return (
    <Panel
      title={compact ? "Recent tickets" : "Ticket queue"}
      subtitle={
        compact
          ? "The latest requests in your workspace"
          : matching.length + " matching tickets"
      }
      className="table-panel"
      actions={
        compact && (
          <Link className="btn small" href={"/" + role + "/tickets"}>
            View all <ArrowRight size={14} />
          </Link>
        )
      }
    >
      {!compact && (
        <div className="filters">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search tickets"
              autoFocus={focusSearch}
              placeholder="Search by ID, subject, or customer…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All priorities</option>
            {priorities.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {(status || priority || category || search) && (
            <button
              className="btn small"
              onClick={() => {
                setStatus("");
                setPriority("");
                setCategory("");
                setSearch("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {visible.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <button onClick={() => sortBy("subject")}>
                    Ticket {sortIcon("subject")}
                  </button>
                </th>
                {role !== "customer" && <th>Customer</th>}
                <th>Status</th>
                <th>
                  <button onClick={() => sortBy("priority")}>
                    Priority {sortIcon("priority")}
                  </button>
                </th>
                {!compact && <th>Category</th>}
                <th>
                  <button onClick={() => sortBy("dueAt")}>
                    SLA {sortIcon("dueAt")}
                  </button>
                </th>
                {!compact && (
                  <th>
                    <button onClick={() => sortBy("createdAt")}>
                      Created {sortIcon("createdAt")}
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const customer = db?.customers.find(
                  (c) => c.id === t.customerId,
                );
                return (
                  <tr key={t.id}>
                    <td>
                      <Link
                        className="ticket-link"
                        href={"/" + role + "/tickets/" + t.id}
                      >
                        <small>#{t.id}</small>
                        <strong>{t.subject}</strong>
                      </Link>
                    </td>
                    {role !== "customer" && (
                      <td>
                        <span className="person-cell">
                          <Avatar
                            name={customer?.name ?? "Unknown"}
                            index={Number(t.customerId.slice(1)) || 0}
                          />
                          {customer?.name ?? "Unknown"}
                        </span>
                      </td>
                    )}
                    <td>
                      <Badge dot>{t.status}</Badge>
                    </td>
                    <td>
                      <Badge dot>{t.priority}</Badge>
                    </td>
                    {!compact && <td>{t.category}</td>}
                    <td>
                      <SLA
                        ticket={t}
                        now={now}
                        withDate={!compact || role === "customer"}
                      />
                    </td>
                    {!compact && <td>{dateTime(t.createdAt)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="No tickets match this view." />
      )}
      {!compact && pages > 1 && (
        <div className="pagination">
          <span>
            Page {current} of {pages}
          </span>
          <div>
            <button
              className="btn small"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              className="btn small"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

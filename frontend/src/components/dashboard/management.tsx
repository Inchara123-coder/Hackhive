"use client";

import { Plus, Search, Settings2 } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Dialog,
  Empty,
  PageTitle,
  Panel,
} from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo-store";
import { workload } from "@/lib/utils";
import { priorities, type Agent, type Person } from "@/types";

type Editor = {
  id?: string;
  name: string;
  email: string;
  active: boolean;
  team: string;
  capacity: number;
  availability: Agent["availability"];
};
export function Management({ agents }: { agents: boolean }) {
  const { db, update, notice } = useDemo();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editor>();
  const [error, setError] = useState("");
  const label = agents ? "agent" : "customer";
  if (!db) return null;
  const entries: (Agent | Person)[] = agents ? db.agents : db.customers;
  const people = entries.filter((p) =>
    (p.name + " " + p.email)
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  function open(person?: Person | Agent) {
    const a = person && "team" in person ? person : undefined;
    setEditing({
      id: person?.id,
      name: person?.name ?? "",
      email: person?.email ?? "",
      active: person?.active ?? true,
      team: a?.team ?? "Customer Support",
      capacity: a?.capacity ?? 10,
      availability: a?.availability ?? "Available",
    });
    setError("");
  }
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE MANAGEMENT"
        title={agents ? "Agent Management" : "Customer Management"}
        subtitle={
          agents
            ? "Manage your support team, availability, and ticket capacity."
            : "View and manage the people who use your support portal."
        }
        actions={
          agents && (
            <button className="btn primary" onClick={() => open()}>
              <Plus size={17} /> Add agent
            </button>
          )
        }
      />
      <Panel
        title={agents ? "Support team" : "Customer directory"}
        subtitle={
          people.length + " " + label + (people.length === 1 ? "" : "s")
        }
        actions={
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label={"Search " + label + "s"}
              placeholder={"Search " + label + "s…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        }
      >
        {people.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  {agents && (
                    <>
                      <th>Team</th>
                      <th>Availability</th>
                      <th>Workload</th>
                    </>
                  )}
                  <th>Account status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <span className="person-cell">
                        <Avatar name={p.name} index={i} />
                        <strong>{p.name}</strong>
                      </span>
                    </td>
                    <td>{p.email}</td>
                    {"team" in p && (
                      <>
                        <td>{p.team}</td>
                        <td>
                          <Badge dot>
                            {p.active ? p.availability : "Offline"}
                          </Badge>
                        </td>
                        <td>
                          {workload(db.tickets, p.id)} / {p.capacity}
                        </td>
                      </>
                    )}
                    <td>
                      <span
                        className={"badge " + (p.active ? "green" : "gray")}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn small"
                        aria-label={"Edit " + p.name}
                        onClick={() => open(p)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text={"No " + label + "s match your search."} />
        )}
      </Panel>
      {editing && (
        <Dialog
          title={editing.id ? "Edit " + label : "Add agent"}
          close={() => setEditing(undefined)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const name = editing.name.trim(),
                email = editing.email.trim().toLowerCase();
              if (name.length < 2 || (agents && !editing.team.trim()))
                return setError("Enter a valid name and team.");
              if (
                email === "admin@relaydesk.demo" ||
                [...db.agents, ...db.customers].some(
                  (p) => p.id !== editing.id && p.email.toLowerCase() === email,
                )
              )
                return setError("That email address is already in use.");
              const person = {
                id: editing.id ?? crypto.randomUUID(),
                name,
                email,
                active: editing.active,
              };
              update((next) => {
                if (agents) {
                  const nextAgent = {
                    ...person,
                    team: editing.team.trim(),
                    capacity: editing.capacity,
                    availability: editing.availability,
                  };
                  if (editing.id)
                    next.agents = next.agents.map((p) =>
                      p.id === person.id ? nextAgent : p,
                    );
                  else next.agents.push(nextAgent);
                } else
                  next.customers = next.customers.map((p) =>
                    p.id === person.id ? person : p,
                  );
              });
              notice(editing.id ? "Account updated" : "Agent added");
              setEditing(undefined);
            }}
          >
            <label>
              Name
              <input
                required
                value={editing.name}
                maxLength={70}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={editing.email}
                onChange={(e) =>
                  setEditing({ ...editing, email: e.target.value })
                }
              />
            </label>
            {agents && (
              <>
                <label>
                  Team
                  <input
                    required
                    value={editing.team}
                    maxLength={70}
                    onChange={(e) =>
                      setEditing({ ...editing, team: e.target.value })
                    }
                  />
                </label>
                <div className="form-cols">
                  <label>
                    Availability
                    <select
                      value={editing.availability}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          availability: e.target.value as Agent["availability"],
                        })
                      }
                    >
                      <option>Available</option>
                      <option>Busy</option>
                      <option>Offline</option>
                    </select>
                  </label>
                  <label>
                    Ticket capacity
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={editing.capacity || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          capacity: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />{" "}
              Active account
            </label>
            {!editing.active && agents && (
              <p className="muted">
                Existing tickets stay assigned and can be reassigned in the
                ticket queue.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>
              <button className="btn primary">Save {label}</button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function Settings() {
  const { db, update, notice } = useDemo();
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE MANAGEMENT"
        title="Settings"
        subtitle="Set a resolution deadline for each ticket priority."
      />
      <Panel
        title="SLA policy"
        subtitle="New tickets use the policy in effect at submission. Existing deadlines stay unchanged."
        className="narrow-panel"
      >
        <form
          className="form-stack panel-body"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            update((next) =>
              priorities.forEach((p) => {
                next.sla[p] = Number(values.get(p));
              }),
            );
            notice("SLA policy saved");
          }}
        >
          {priorities.map((p) => (
            <label key={p}>
              {p} resolution window (hours)
              <input
                required
                type="number"
                step=".25"
                min=".25"
                max="720"
                name={p}
                defaultValue={db?.sla[p]}
              />
            </label>
          ))}
          <button className="btn primary">
            <Settings2 size={16} /> Save SLA policy
          </button>
        </form>
      </Panel>
    </>
  );
}

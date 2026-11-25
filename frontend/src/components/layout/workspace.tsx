"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  LogOut,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useDemo } from "@/lib/demo-store";
import {
  AdminDashboard,
  PersonalDashboard,
} from "@/components/dashboard/dashboard";
import {
  CannedResponses,
  Notes,
  NotificationList,
  Notifications,
  Profile,
} from "@/components/dashboard/account-pages";
import { Management, Settings } from "@/components/dashboard/management";
import { SLACenter } from "@/components/dashboard/sla-center";
import { CreateTicket } from "@/components/forms/create-ticket";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { TicketTable } from "@/components/tickets/ticket-table";
import {
  Avatar,
  Brand,
  Dialog,
  Empty,
  PageTitle,
  Panel,
  Toast,
} from "@/components/ui/primitives";
import type { Role } from "@/types";
import { menus, roleNames } from "./navigation";

export function Entry() {
  const { db, session, login } = useDemo();
  const router = useRouter();
  useEffect(() => {
    if (!db) return;
    if (!session) {
      login({ role: "admin", id: "admin" });
      return;
    }
    router.replace("/" + session.role + "/dashboard");
  }, [db, session, login, router]);
  return <Loading />;
}
function Loading() {
  return (
    <div className="loading" role="status">
      <Brand />
      <span>Opening workspace…</span>
    </div>
  );
}
export function Workspace({
  role,
  section,
  ticketId,
}: {
  role: Role;
  section: string;
  ticketId?: string;
}) {
  const store = useDemo();
  const { db, session, person, tickets, toast, logout } = store;
  const router = useRouter();
  const [nav, setNav] = useState(false);
  const [modal, setModal] = useState<
    "search" | "notifications" | "account" | "help"
  >();
  const [query, setQuery] = useState("");
  const pages = menus[role].flatMap((group) => group.items);
  const label = pages.find((p) => p.path === section)?.name;
  const unread =
    db?.notices.filter((n) => n.recipient === session?.id && !n.read).length ??
    0;
  useEffect(() => {
    if (!db) return;
    if (!session || !person) router.replace("/demo");
    else if (session.role !== role)
      router.replace("/" + session.role + "/dashboard");
  }, [db, session, person, role, router]);
  useEffect(() => {
    function listen(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setModal("search");
      }
    }
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);
  if (!db || !person || session?.role !== role) return <Loading />;
  const signOut = () => {
    logout();
    router.replace("/demo");
  };
  const ticket = tickets.find((t) => t.id === ticketId);
  const matches = tickets
    .filter((t) =>
      (t.id + " " + t.subject)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, 8);
  let content: ReactNode;
  if (!label || (ticketId && !ticket))
    content = (
      <>
        <PageTitle
          eyebrow="RELAYDESK"
          title={ticketId ? "Ticket not found" : "Page not found"}
          subtitle="This item is unavailable in your workspace."
          actions={
            <Link className="btn primary" href={"/" + role + "/dashboard"}>
              Back to dashboard
            </Link>
          }
        />
        <Panel title="Unavailable">
          <Empty text="Try another page from the sidebar." />
        </Panel>
      </>
    );
  else
    switch (section) {
      case "dashboard":
        content =
          role === "admin" ? (
            <AdminDashboard />
          ) : (
            <PersonalDashboard role={role} />
          );
        break;
      case "tickets":
        content = ticket ? (
          <TicketDetail key={ticket.id} ticket={ticket} role={role} />
        ) : (
          <>
            <PageTitle
              eyebrow={
                role === "admin"
                  ? "SUPPORT OPERATIONS"
                  : role === "agent"
                    ? "AGENT WORKSPACE"
                    : "CUSTOMER PORTAL"
              }
              title={label}
              subtitle="Search, filter, and open requests in your workspace."
              actions={
                role === "customer" && (
                  <Link className="btn primary" href="/customer/create-ticket">
                    <Plus size={17} /> Create New Ticket
                  </Link>
                )
              }
            />
            <TicketTable tickets={tickets} role={role} />
          </>
        );
        break;
      case "create-ticket":
        content = <CreateTicket />;
        break;
      case "analytics":
        content = <AdminDashboard analytics />;
        break;
      case "sla-monitoring":
      case "sla-rescue":
        content = <SLACenter rescue={section === "sla-rescue"} />;
        break;
      case "agents":
      case "customers":
        content = <Management key={section} agents={section === "agents"} />;
        break;
      case "settings":
        content = <Settings />;
        break;
      case "profile":
        content = <Profile />;
        break;
      case "notifications":
        content = <Notifications role={role} />;
        break;
      case "notes":
        content = <Notes />;
        break;
      case "canned-responses":
        content = <CannedResponses />;
        break;
    }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {nav && (
        <button
          className="mobile-overlay"
          onClick={() => setNav(false)}
          aria-label="Close sidebar"
        />
      )}
      <aside
        id="workspace-sidebar"
        className={"sidebar " + (nav ? "is-open" : "")}
      >
        <div className="sidebar-brand">
          <Link href={"/" + role + "/dashboard"} onClick={() => setNav(false)}>
            <Brand />
          </Link>
          <button
            className="icon-btn close-nav"
            onClick={() => setNav(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>
        <button
          className="workspace-select"
          onClick={() => {
            setNav(false);
            setModal("account");
          }}
        >
          <span className="workspace-initial">
            {role === "admin" ? "S" : role === "agent" ? "A" : "C"}
          </span>
          <span>
            <strong>
              {role === "admin"
                ? "Support Workspace"
                : role === "agent"
                  ? "Agent Workspace"
                  : "Customer Portal"}
            </strong>
            <small>{roleNames[role]} workspace</small>
          </span>
          <ChevronsUpDown size={15} />
        </button>
        <nav aria-label="Workspace navigation">
          {menus[role].map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  aria-current={section === item.path ? "page" : undefined}
                  className={
                    "nav-link " + (section === item.path ? "active" : "")
                  }
                  href={"/" + role + "/" + item.path}
                  onClick={() => setNav(false)}
                >
                  <item.icon size={17} />
                  <span>{item.name}</span>
                  {item.path === "sla-rescue" && <span className="nav-live" />}
                  {item.path === "notifications" && unread > 0 && (
                    <span className="nav-count">{unread}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          <button
            className="nav-link"
            onClick={() => {
              setNav(false);
              setModal("help");
            }}
          >
            <CircleHelp size={17} />
            <span>Help &amp; demo guide</span>
          </button>
          <button className="nav-link" onClick={signOut}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
          <div className="side-person">
            <Avatar name={person.name} />
            <span>
              <strong>{person.name}</strong>
              <small>
                {role === "admin"
                  ? "Support administrator"
                  : role === "agent"
                    ? "Support agent"
                    : "Support customer"}
              </small>
            </span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="crumbs">
            <button
              className="icon-btn hamburger"
              aria-label="Open menu"
              aria-expanded={nav}
              aria-controls="workspace-sidebar"
              onClick={() => setNav(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{ticket ? ticket.id : (label ?? "Unavailable")}</strong>
          </div>
          <div className="top-actions">
            <button
              className="global-search"
              onClick={() => {
                setQuery("");
                setModal("search");
              }}
              aria-label="Search workspace"
            >
              <Search size={16} />
              <span>Search anything...</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="icon-btn bell-button"
              onClick={() => setModal("notifications")}
              aria-label={
                unread
                  ? "Notifications, " + unread + " unread"
                  : "Notifications"
              }
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <span className="top-divider" />
            <button
              className="top-profile"
              onClick={() => setModal("account")}
              aria-label="Account options"
            >
              <Avatar name={person.name} />
              <span>
                <strong>{person.name}</strong>
                <small>{roleNames[role]}</small>
              </span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {content}
          <footer className="footer">
            <span>© {new Date().getFullYear()} RelayDesk</span>
            <button className="demo-pill" onClick={() => setModal("help")}>
              <i /> Demo workspace
            </button>
          </footer>
        </main>
      </div>
      {modal === "search" && (
        <Dialog title="Search tickets" close={() => setModal(undefined)}>
          <label className="search-field dialog-search">
            <Search size={17} />
            <input
              autoFocus
              aria-label="Search workspace tickets"
              placeholder="Find a ticket by ID or subject…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="list-stack">
            {matches.length ? (
              matches.map((t) => (
                <Link
                  key={t.id}
                  className="list-row"
                  href={"/" + role + "/tickets/" + t.id}
                  onClick={() => setModal(undefined)}
                >
                  <span>
                    <small>#{t.id}</small>
                    <strong>{t.subject}</strong>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ))
            ) : (
              <Empty text="No matching tickets." />
            )}
          </div>
        </Dialog>
      )}
      {modal === "notifications" && (
        <Dialog title="Notifications" close={() => setModal(undefined)}>
          <NotificationList role={role} close={() => setModal(undefined)} />
        </Dialog>
      )}
      {modal === "account" && (
        <Dialog title="Your workspace" close={() => setModal(undefined)}>
          <p className="muted">
            You are viewing the {role} experience with demo data stored in this
            browser.
          </p>
          <div className="form-actions">
            <button className="btn" onClick={signOut}>
              <LogOut size={15} /> Logout
            </button>
            <Link href="/demo" className="btn primary">
              <ArrowLeftRight size={15} /> Switch demo role
            </Link>
          </div>
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog
          title="About the RelayDesk demo"
          close={() => setModal(undefined)}
        >
          <p className="muted">
            This workspace uses synthetic tickets and local browser storage.
            Priority detection, assignment, SLA escalation, and notifications
            are simulated. Attachments are shown by filename only.
          </p>
          <div className="form-actions">
            <Link href="/demo" className="btn">
              Explore demo roles
            </Link>
            <button className="btn primary" onClick={() => setModal(undefined)}>
              Back to workspace
            </button>
          </div>
        </Dialog>
      )}
      <Toast message={toast} />
    </div>
  );
}

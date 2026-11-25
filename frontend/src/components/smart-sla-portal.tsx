"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiFetch, apiUrl } from "@/lib/api-client";
import { createHelpdeskSocket } from "@/lib/realtime";
import type { Socket } from "socket.io-client";

type User = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "AGENT" | "ADMIN";
};
type Solution = {
  title?: string;
  steps: string[];
  recommended: string;
  relevance?: number;
};
type Ticket = {
  id: string;
  publicId: string;
  application: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  priorityReason: string;
  status: string;
  customerId: string;
  assignedAgentId?: string;
  customer?: { name: string; email: string };
  assignedAgent?: { id: string; name: string };
  analysis?: {
    predictedCategory: string;
    categoryConfidence: number;
    predictedPriority: string;
    priorityConfidence: number;
    sentiment: string;
    sentimentScore: number;
    duplicateTicketIds: string[];
  };
  suggestions?: (Solution & { knowledgeBase?: { title: string } })[];
  messages?: { id: string; body: string; createdAt: string; author: { name: string; role: string } }[];
  internalNotes?: { id: string; body: string; createdAt: string; author: { name: string } }[];
  history?: { id: string; event: string; createdAt: string }[];
  attachments?: { id: string; originalName: string; sizeBytes: number }[];
  sla?: { state: string; firstResponseDue: string; resolutionDue: string; breachedAt?: string };
  feedback?: { rating: number; comment?: string } | null;
};
type Agent = { id: string; name: string; active: boolean; workload: number };
type AnalysisPreview = {
  analysis: {
    category: string;
    categoryConfidence: number;
    priority: string;
    priorityConfidence: number;
    sentiment: string;
    priorityReason: string;
    duplicates: { ticketId: string; score: number }[];
  };
  solution: Solution | null;
};
type AnalyticsReport = {
  metrics: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    aiSelfServiceResolutions: number;
    slaBreaches: number;
    slaCompliancePercent: number | null;
    averageCsat: number | null;
  };
  agentWorkload: {
    agentId: string;
    name: string;
    active: boolean;
    capacity: number;
    availability: string;
    workload: number;
  }[];
  byCategory: { category: string; total: number }[];
  byPriority: { priority: string; total: number }[];
  ratingDistribution: { rating: number; total: number }[];
};
type RescueRecommendation = {
  publicId: string;
  priority: string;
  reason: string;
  recommendedAction: string;
};

const defaultApplications = [
  "Google Pay", "PhonePe", "Amazon", "Flipkart", "Swiggy", "Zomato",
  "Uber", "Rapido", "MyJio", "Airtel Thanks", "Netflix", "Other",
];
const categories = [
  "PAYMENT", "LOGIN", "REFUND", "DELIVERY", "TECHNICAL",
  "ACCOUNT", "NETWORK", "SUBSCRIPTION", "OTHER",
];

export function SmartSlaPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<{ id: string; title: string; body: string }[]>([]);
  const [report, setReport] = useState<AnalyticsReport>();
  const [rescueItems, setRescueItems] = useState<RescueRecommendation[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisPreview>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [applicationNames, setApplicationNames] = useState(defaultApplications);
  const [application, setApplication] = useState(defaultApplications[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [reply, setReply] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [rating, setRating] = useState(5);
  const [agentId, setAgentId] = useState("");
  const socketRef = useRef<Socket | null>(null);

  async function loadWorkspace(currentUser: User) {
    const [result, applicationResult] = await Promise.all([
      apiFetch<{ tickets: Ticket[] }>("/tickets?limit=100"),
      apiFetch<{ applications: { id: string; name: string }[] }>("/applications"),
    ]);
    setTickets(result.tickets);
    if (applicationResult.applications.length) {
      const names = applicationResult.applications.map((item) => item.name);
      setApplicationNames(names);
      setApplication((current) => names.includes(current) ? current : names[0]);
    }
    if (currentUser.role === "ADMIN") {
      const [agentResult, analytics, rescue] = await Promise.all([
        apiFetch<{ agents: Agent[] }>("/agents"),
        apiFetch<AnalyticsReport>("/analytics"),
        apiFetch<{ recommendations: RescueRecommendation[] }>("/sla/rescue"),
      ]);
      setAgents(agentResult.agents);
      setReport(analytics);
      setRescueItems(rescue.recommendations);
    } else if (currentUser.role === "AGENT") {
      const [agentResult, canned] = await Promise.all([
        apiFetch<{ agents: Agent[] }>("/agents"),
        apiFetch<{ templates: { id: string; title: string; body: string }[] }>("/templates"),
      ]);
      setAgents(agentResult.agents);
      setTemplates(canned.templates);
    }
  }

  useEffect(() => {
    apiFetch<{ user: User }>("/auth/session")
      .then(async ({ user: currentUser }) => {
        setUser(currentUser);
        await loadWorkspace(currentUser);
      })
      .catch((issue: unknown) => {
        if (!(issue instanceof ApiError && issue.status === 401))
          setError(issue instanceof Error ? issue.message : "Could not connect to RelayDesk.");
      })
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    const socket = createHelpdeskSocket();
    socketRef.current = socket;
    socket.on("notification:new", () => {
      void loadWorkspace(user).catch((issue: unknown) =>
        setError(issue instanceof Error ? issue.message : "Could not refresh tickets."),
      );
    });
    socket.on("connect_error", (issue: Error) => {
      setError(`Live updates are unavailable: ${issue.message}`);
    });
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selected) return;
    const refresh = () => {
      void refreshTicket(selected.publicId).catch((issue: unknown) =>
        setError(issue instanceof Error ? issue.message : "Could not refresh ticket."),
      );
    };
    socket.emit("ticket:join", selected.publicId);
    socket.on("ticket:message", refresh);
    socket.on("ticket:internal-note", refresh);
    return () => {
      socket.emit("ticket:leave", selected.publicId);
      socket.off("ticket:message", refresh);
      socket.off("ticket:internal-note", refresh);
    };
  }, [selected?.publicId, user]);

  async function refreshTicket(publicId: string) {
    const result = await apiFetch<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(publicId)}`);
    setSelected(result.ticket);
    setTickets((current) =>
      current.map((ticket) => ticket.id === result.ticket.id ? result.ticket : ticket),
    );
    return result.ticket;
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const userResult =
        mode === "register"
          ? await apiFetch<{ user: User }>("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                name: form.get("name"),
                email: form.get("email"),
                password: form.get("password"),
              }),
            })
          : await apiFetch<{ user: User }>("/auth/login", {
              method: "POST",
              body: JSON.stringify({
                email: form.get("email"),
                password: form.get("password"),
              }),
            });
      setUser(userResult.user);
      await loadWorkspace(userResult.user);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError("");
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      setUser(null);
      setTickets([]);
      setSelected(null);
      setReport(undefined);
      setRescueItems([]);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not sign out.");
    }
  }

  async function openTicket(publicId: string) {
    setError("");
    try {
      await refreshTicket(publicId);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not open ticket.");
    }
  }

  async function refreshWorkspace() {
    if (!user) return;
    setError("");
    try {
      await loadWorkspace(user);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not refresh tickets.");
    }
  }

  async function previewComplaint() {
    setError("");
    setBusy(true);
    try {
      const result = await apiFetch<AnalysisPreview>("/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ application, subject, description }),
      });
      setAnalysis(result);
      if (result.analysis.categoryConfidence >= 0.35)
        setCategory(result.analysis.category);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiFetch<{ ticket: Ticket }>("/tickets", {
        method: "POST",
        body: JSON.stringify({ application, subject, description, category }),
      });
      const ticket = await refreshTicket(result.ticket.publicId);
      setMessage(`Complaint ${ticket.publicId} created.`);
      await loadWorkspace(user!);
      setSubject("");
      setDescription("");
      setAnalysis(undefined);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not create complaint.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveSuggestion(resolved: boolean) {
    if (!selected) return;
    setError("");
    setBusy(true);
    try {
      await apiFetch(`/tickets/${selected.publicId}/solution-feedback`, {
        method: "POST",
        body: JSON.stringify({ resolved }),
      });
      const updated = await refreshTicket(selected.publicId);
      setMessage(
        resolved
          ? "Thanks for confirming. The ticket was closed as self-service."
          : "Thanks for letting us know. The ticket is being routed to support.",
      );
      await loadWorkspace(user!);
      setSelected(updated);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not save your response.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/tickets/${selected.publicId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply }),
      });
      setReply("");
      await refreshTicket(selected.publicId);
      setMessage("Reply sent.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not send reply.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/tickets/${selected.publicId}/internal-notes`, {
        method: "POST",
        body: JSON.stringify({ body: privateNote }),
      });
      setPrivateNote("");
      await refreshTicket(selected.publicId);
      setMessage("Internal note saved for staff.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not save note.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/tickets/${selected.publicId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshTicket(selected.publicId);
      await loadWorkspace(user!);
      setMessage("Ticket status updated.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  async function assignTicket() {
    if (!selected || !agentId) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/tickets/${selected.publicId}/assignment`, {
        method: "POST",
        body: JSON.stringify({ agentId }),
      });
      await refreshTicket(selected.publicId);
      await loadWorkspace(user!);
      setMessage("Ticket assigned.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not assign ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRescue(item: RescueRecommendation) {
    setBusy(true);
    setError("");
    try {
      const action = item.recommendedAction.toLowerCase().includes("escalate")
        ? "escalate"
        : "automatic";
      const result = await apiFetch<{ action: string }>(`/sla/rescue/${item.publicId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setMessage(
        result.action === "unassigned"
          ? `No available matching agent could take ${item.publicId}. Admins have been notified.`
          : result.action === "already-escalated"
            ? `${item.publicId} was already escalated.`
            : `Confirmed SLA rescue for ${item.publicId}.`,
      );
      await loadWorkspace(user!);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not apply SLA rescue.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/tickets/${selected.publicId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
      await refreshTicket(selected.publicId);
      setMessage("Thank you for your feedback.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not save feedback.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) return;
    const data = new FormData();
    data.set("file", file);
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/tickets/${selected.publicId}/attachments`, {
        method: "POST",
        body: data,
      });
      form.reset();
      await refreshTicket(selected.publicId);
      setMessage("Attachment uploaded.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return <main className="smart-shell">Connecting to RelayDesk…</main>;
  if (!user)
    return (
      <main className="smart-shell">
        <header className="smart-header">
          <div><strong>RelayDesk</strong><small>Live workspace · data saved to PostgreSQL</small></div>
          <Link href="/demo">Open the local-only demo preview</Link>
        </header>
        <section className="smart-card smart-auth">
          <p className="smart-eyebrow">CUSTOMER SUPPORT WORKSPACE</p>
          <h1>{mode === "register" ? "Create your account" : "Sign in to RelayDesk"}</h1>
          <p>Submit a complaint, review safe troubleshooting guidance, and track support progress.</p>
          <form className="form-stack" onSubmit={authenticate}>
            {mode === "register" && <label>Name<input name="name" required minLength={2} maxLength={100} /></label>}
            <label>Email<input name="email" type="email" required autoComplete="username" /></label>
            <label>Password<input name="password" type="password" required minLength={12} autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
          </form>
          <button className="text-btn" onClick={() => { setError(""); setMode(mode === "register" ? "login" : "register"); }}>
            {mode === "register" ? "Already registered? Sign in" : "New customer? Create an account"}
          </button>
          <p className="smart-hint">
            Hackathon accounts: admin@smartsla.demo, agent1@smartsla.demo, or
            customer1@smartsla.demo. Default password: SmartSLA123! (unless
            changed with DEMO_SEED_PASSWORD in backend/.env).
          </p>
        </section>
      </main>
    );

  const staff = user.role !== "CUSTOMER";
  return (
    <main className="smart-shell">
      <header className="smart-header">
        <div><strong>RelayDesk</strong><small>{user.name} · {user.role.toLowerCase()}</small></div>
        <div className="smart-header-actions">
          <span>{user.email}</span>
          <button className="btn small" onClick={() => void logout()}>Sign out</button>
          <Link href="/demo">Local-only demo preview</Link>
        </div>
      </header>
      <div className="smart-content">
        {message && <p className="smart-success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {report && (
          <section className="smart-metrics">
            <div><small>Total tickets</small><strong>{report.metrics.totalTickets}</strong></div>
            <div><small>Open</small><strong>{report.metrics.openTickets}</strong></div>
            <div><small>Closed</small><strong>{report.metrics.closedTickets}</strong></div>
            <div><small>Self-service resolved</small><strong>{report.metrics.aiSelfServiceResolutions}</strong></div>
            <div><small>SLA breaches</small><strong>{report.metrics.slaBreaches}</strong></div>
            <div><small>SLA compliance</small><strong>{report.metrics.slaCompliancePercent === null ? "—" : `${report.metrics.slaCompliancePercent}%`}</strong></div>
            <div><small>Average CSAT</small><strong>{report.metrics.averageCsat?.toFixed(1) ?? "—"}</strong></div>
          </section>
        )}
        {user.role === "ADMIN" && report && (
          <section className="smart-card">
            <p className="smart-eyebrow">OPERATIONS REPORT</p>
            <div className="smart-report-grid">
              <div><h3>Agent workload</h3>{report.agentWorkload.map((agent) => <p key={agent.agentId}>{agent.name} · {agent.workload}/{agent.capacity} · {agent.availability.toLowerCase()}{!agent.active ? " · inactive" : ""}</p>)}</div>
              <div><h3>By category</h3>{report.byCategory.map((item) => <p key={item.category}>{item.category} · {item.total}</p>)}</div>
              <div><h3>By priority</h3>{report.byPriority.map((item) => <p key={item.priority}>{item.priority} · {item.total}</p>)}</div>
              <div><h3>CSAT ratings</h3>{report.ratingDistribution.map((item) => <p key={item.rating}>{item.rating} stars · {item.total}</p>)}</div>
            </div>
          </section>
        )}
        {user.role === "ADMIN" && (
          <section className="smart-card">
            <div className="smart-section-title"><div><p className="smart-eyebrow">SLA RESCUE MODE</p><h2>Items needing attention</h2></div><button className="btn small" disabled={busy} onClick={() => void refreshWorkspace()}>Refresh</button></div>
            {rescueItems.length ? rescueItems.map((item, index) => (
              <div className="smart-rescue-item" key={`${item.publicId}-${item.reason}-${index}`}>
                <span><strong>{item.publicId} · {item.priority}</strong><small>{item.reason} {item.recommendedAction}</small></span>
                <div className="smart-actions"><button className="btn small" onClick={() => void openTicket(item.publicId)}>Review</button><button className="btn small primary" disabled={busy} onClick={() => void confirmRescue(item)}>Confirm action</button></div>
              </div>
            )) : <p className="muted">No SLA rescue actions are currently recommended.</p>}
          </section>
        )}
        {user.role === "CUSTOMER" && (
          <section className="smart-card">
            <p className="smart-eyebrow">CUSTOMER PORTAL</p>
            <h1>Tell us what happened</h1>
            <p>RelayDesk can suggest approved troubleshooting steps. It cannot access third-party accounts or process refunds.</p>
            <form className="form-stack" onSubmit={createComplaint}>
              <label>Application<select value={application} onChange={(event) => setApplication(event.target.value)}>{applicationNames.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={6} maxLength={160} /></label>
              <label>Complaint details<textarea value={description} onChange={(event) => setDescription(event.target.value)} required minLength={12} maxLength={4000} rows={4} /></label>
              <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <div className="smart-actions">
                <button className="btn" type="button" disabled={busy || subject.length < 6 || description.length < 12} onClick={() => void previewComplaint()}>Analyze &amp; preview</button>
                <button className="btn primary" disabled={busy}>{busy ? "Submitting…" : "Submit complaint"}</button>
              </div>
            </form>
            {analysis && (
              <div className="smart-analysis">
                <strong>AI preview · {analysis.analysis.category} · {analysis.analysis.priority} · {analysis.analysis.sentiment}</strong>
                <span>{analysis.analysis.priorityReason}</span>
                <small>Category confidence: {Math.round(analysis.analysis.categoryConfidence * 100)}%. Synthetic model; review with support if needed.</small>
                {analysis.solution && <p><b>{analysis.solution.title}</b><br />{analysis.solution.steps.join(" · ")}</p>}
                {analysis.analysis.duplicates.length > 0 && <p>Similar open ticket IDs: {analysis.analysis.duplicates.map((item) => item.ticketId).join(", ")}. They are not merged or removed.</p>}
              </div>
            )}
          </section>
        )}
        <div className="smart-workspace">
          <section className="smart-card">
            <div className="smart-section-title"><div><p className="smart-eyebrow">WORK QUEUE</p><h2>{staff ? user.role === "ADMIN" ? "All complaints" : "Assigned complaints" : "Your complaints"}</h2></div><button className="btn small" onClick={() => void refreshWorkspace()}>Refresh</button></div>
            {tickets.length ? (
              <div className="smart-ticket-list">
                {tickets.map((ticket) => (
                  <button className={"smart-ticket " + (selected?.id === ticket.id ? "selected" : "")} key={ticket.id} onClick={() => void openTicket(ticket.publicId)}>
                    <span><strong>{ticket.publicId} · {ticket.subject}</strong><small>{ticket.application} · {ticket.status} · {ticket.priority}</small></span>
                    <small>{ticket.sla?.state ?? "SLA pending"}</small>
                  </button>
                ))}
              </div>
            ) : <p className="muted">No complaints yet.</p>}
          </section>
          {selected && (
            <section className="smart-card">
              <p className="smart-eyebrow">TICKET {selected.publicId}</p>
              <h2>{selected.subject}</h2>
              <p>{selected.application} · {selected.category} · {selected.priority} · {selected.status}</p>
              <p>{selected.description}</p>
              {selected.analysis && <div className="smart-analysis"><strong>AI analysis · {selected.analysis.predictedCategory} ({Math.round(selected.analysis.categoryConfidence * 100)}%) · {selected.analysis.sentiment}</strong><span>{selected.priorityReason}</span>{selected.analysis.duplicateTicketIds.length > 0 && <small>Similar tickets: {selected.analysis.duplicateTicketIds.join(", ")}</small>}</div>}
              {selected.suggestions?.map((suggestion, index) => (
                <div className="smart-analysis" key={index}><strong>{suggestion.title ?? suggestion.knowledgeBase?.title ?? "Suggested troubleshooting"}</strong><ol>{suggestion.steps.map((step) => <li key={step}>{step}</li>)}</ol><p>{suggestion.recommended}</p></div>
              ))}
              {user.role === "CUSTOMER" && selected.status === "SELF_SERVICE" && <div className="smart-actions"><button className="btn primary" disabled={busy} onClick={() => void resolveSuggestion(true)}>Yes, problem solved</button><button className="btn" disabled={busy} onClick={() => void resolveSuggestion(false)}>No, still need help</button></div>}
              <div className="smart-ticket-meta"><span>Assigned: {selected.assignedAgent?.name ?? "Unassigned"}</span><span>First response due: {selected.sla?.firstResponseDue ? new Date(selected.sla.firstResponseDue).toLocaleString() : "—"}</span><span>Resolution due: {selected.sla?.resolutionDue ? new Date(selected.sla.resolutionDue).toLocaleString() : "—"}</span></div>
              {user.role === "ADMIN" && (
                <div className="smart-actions"><select aria-label="Assign agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">Choose agent</option>{agents.filter((agent) => agent.active).map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · workload {agent.workload}</option>)}</select><button className="btn" disabled={!agentId || busy} onClick={() => void assignTicket()}>Confirm assignment</button></div>
              )}
              {staff && <label className="smart-status">Update status<select value={selected.status} onChange={(event) => void updateStatus(event.target.value)}><option value="SELF_SERVICE" disabled>Awaiting customer solution</option><option value="OPEN">Open</option><option value="ASSIGNED">Assigned</option><option value="IN_PROGRESS">In progress</option><option value="PENDING">Pending</option><option value="WAITING_FOR_CUSTOMER">Waiting for customer</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></label>}
              <div className="smart-conversation"><h3>Conversation</h3>{selected.messages?.map((item) => <p key={item.id}><b>{item.author.name}</b> · {new Date(item.createdAt).toLocaleString()}<br />{item.body}</p>)}{!selected.messages?.length && <p className="muted">No replies yet.</p>}</div>
              <form className="form-stack" onSubmit={sendReply}><label>Reply<textarea value={reply} onChange={(event) => setReply(event.target.value)} required maxLength={4000} rows={3} /></label>{staff && templates.length > 0 && <select aria-label="Insert canned response" value="" onChange={(event) => { const selectedTemplate = templates.find((item) => item.id === event.target.value); if (selectedTemplate) setReply((current) => current ? `${current}\n\n${selectedTemplate.body}` : selectedTemplate.body); }}><option value="">Insert canned response</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}<button className="btn primary" disabled={busy || !reply.trim()}>Send reply</button></form>
              {staff && <form className="form-stack" onSubmit={saveNote}><label>Private staff note<textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} required maxLength={4000} rows={2} /></label><button className="btn" disabled={busy || !privateNote.trim()}>Add internal note</button>{selected.internalNotes?.map((note) => <small key={note.id}><b>{note.author.name}</b> · {note.body}</small>)}</form>}
              {user.role === "CUSTOMER" && <form className="smart-actions" onSubmit={uploadAttachment}><label>Attachment (PDF, PNG, JPEG, TXT; max 5 MB)<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" /></label><button className="btn" disabled={busy}>Upload</button></form>}
              {!!selected.attachments?.length && <div><h3>Attachments</h3>{selected.attachments.map((file) => <a className="smart-attachment" key={file.id} href={apiUrl(`/tickets/${selected.publicId}/attachments/${file.id}`)} target="_blank" rel="noreferrer">{file.originalName}</a>)}</div>}
              {user.role === "CUSTOMER" && (selected.status === "RESOLVED" || selected.status === "CLOSED") && <form className="smart-actions" onSubmit={submitFeedback}><label>Rate support (1-5)<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value > 1 ? "s" : ""}</option>)}</select></label><button className="btn primary" disabled={busy}>Submit CSAT</button>{selected.feedback && <small>Submitted rating: {selected.feedback.rating}/5</small>}</form>}
              {selected.history?.length ? <div className="smart-history"><h3>History</h3>{selected.history.map((item) => <p key={item.id}>{item.event} · {new Date(item.createdAt).toLocaleString()}</p>)}</div> : null}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

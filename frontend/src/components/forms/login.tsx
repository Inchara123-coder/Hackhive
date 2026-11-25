"use client";

import {
  ArrowRight,
  ChartNoAxesCombined,
  Eye,
  EyeOff,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Brand, Dialog, Toast } from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo-store";
import { accounts, demoPassword } from "@/lib/mock-data";
import { roles, type Role } from "@/types";

const roleIcons = {
  admin: ShieldCheck,
  agent: Headphones,
  customer: UsersRound,
};
export function Login() {
  const store = useDemo();
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  function open(role: Role) {
    router.replace("/" + role + "/dashboard");
  }
  function select(role: Role) {
    const signed = store.signIn(accounts[role].email, demoPassword, remember);
    if (signed) open(signed);
    else setError("This demo account is inactive.");
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "register") {
      if (name.trim().length < 2)
        return setError("Enter at least two characters for your name.");
      if (!store.register(name.trim(), email.trim().toLowerCase(), remember))
        return setError("That email is already in use in this demo.");
      return open("customer");
    }
    const signed = store.signIn(email, password, remember);
    if (signed) open(signed);
    else setError("Use an active demo account and the password shown below.");
  }
  return (
    <div className="login-layout">
      <aside className="login-poster">
        <Brand />
        <div className="poster-copy">
          <span className="poster-tag">
            <span /> SUPPORT OPERATIONS PLATFORM
          </span>
          <h1>
            Better support.
            <br />
            Every ticket.
            <br />
            <em>Every time.</em>
          </h1>
          <p>
            Manage requests, meet service deadlines, and give customers a clear
            view of what happens next.
          </p>
          <div className="poster-metric">
            <span>
              <ChartNoAxesCombined size={23} />
            </span>
            <div>
              <strong>One shared workspace</strong>
              <small>Customers, agents and support managers</small>
            </div>
          </div>
        </div>
        <small>RelayDesk · Customer Support &amp; SLA Ticketing</small>
      </aside>
      <main className="login-main">
        <div className="login-form">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="eyebrow">RELAYDESK WORKSPACE</div>
          <h1>
            {mode === "register" ? "Create a demo profile" : "Welcome back"}
          </h1>
          <p>
            {mode === "register"
              ? "Try the customer portal with a profile stored in this browser. Use the shared demo password to sign in again."
              : "Sign in to your workspace or choose a demo role."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode === "register" && (
              <label>
                Full name
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Olivia Parker"
                  maxLength={70}
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {mode === "sign-in" && (
              <label>
                Password
                <span className="password-field">
                  <input
                    required
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter demo password"
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}
            <div className="login-options">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />{" "}
                Remember me
              </label>
              {mode === "sign-in" && (
                <button
                  className="text-btn"
                  type="button"
                  onClick={() => setForgot(true)}
                >
                  Forgot password?
                </button>
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary full" disabled={!store.db}>
              {mode === "register" ? "Create profile" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="demo-login">
            <div className="demo-divider">OR EXPLORE THE DEMO</div>
            <div className="role-buttons">
              {roles.map((role) => {
                const Icon = roleIcons[role];
                return (
                  <button
                    className="btn"
                    disabled={!store.db}
                    key={role}
                    onClick={() => select(role)}
                  >
                    <Icon size={17} />
                    {role === "admin"
                      ? "Admin"
                      : role === "agent"
                        ? "Agent"
                        : "Customer"}
                  </button>
                );
              })}
            </div>
            <small>
              <LockKeyhole size={12} /> Demo password:{" "}
              <strong>{demoPassword}</strong>
            </small>
          </div>
          <p className="register-switch">
            {mode === "register"
              ? "Already using a demo account?"
              : "New to RelayDesk?"}{" "}
            <button
              className="text-btn"
              onClick={() => {
                setMode(mode === "register" ? "sign-in" : "register");
                setError("");
              }}
            >
              {mode === "register"
                ? "Back to sign in"
                : "Create customer profile"}
            </button>
          </p>
          <p className="register-switch">
            Want tickets saved to the live database?{" "}
            <Link className="text-btn" href="/">
              Open the RelayDesk workspace
            </Link>
          </p>
        </div>
      </main>
      {forgot && (
        <Dialog title="Demo password help" close={() => setForgot(false)}>
          <p className="muted">
            Use any of these demo accounts with <strong>{demoPassword}</strong>.
            The demo does not send password reset emails.
          </p>
          <ul className="plain-list">
            {roles.map((role) => (
              <li key={role}>{accounts[role].email}</li>
            ))}
          </ul>
          <button className="btn primary" onClick={() => setForgot(false)}>
            Got it
          </button>
        </Dialog>
      )}
      <Toast message={store.toast} />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { CircleAlert, File, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, PageTitle, Panel } from "@/components/ui/primitives";
import { useDemo } from "@/lib/demo-store";
import { detect, similar } from "@/lib/utils";
import { categories, type Category } from "@/types";
import Link from "next/link";

export function CreateTicket() {
  const { tickets, createTicket } = useDemo();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const detection = detect(subject + " " + description);
  const duplicate =
    subject.trim().length >= 6 &&
    tickets.find((t) => t.status !== "Resolved" && similar(t.subject, subject));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      subject.trim().length < 6 ||
      description.trim().length < 12 ||
      !category
    )
      return setError(
        "Enter a subject of at least 6 characters, a category, and a description of at least 12 characters.",
      );
    const id = createTicket({
      subject: subject.trim(),
      description: description.trim(),
      category,
      attachments: files,
    });
    if (id) router.push("/customer/tickets/" + id);
  }
  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER PORTAL"
        title="Create a support ticket"
        subtitle="Tell us what happened and we’ll route your request to the right team."
      />
      <div className="detail-grid">
        <Panel
          title="Request details"
          subtitle="All fields are required except attachments."
        >
          <form className="form-stack panel-body" onSubmit={submit} noValidate>
            <label>
              Subject
              <input
                placeholder="e.g. Unable to access my billing dashboard"
                maxLength={110}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>
            {duplicate && (
              <div className="callout orange">
                <CircleAlert size={17} />
                <div>
                  <strong>Similar ticket found</strong>
                  <p>
                    <Link href={"/customer/tickets/" + duplicate.id}>
                      {duplicate.id}: {duplicate.subject}
                    </Link>
                    . You can follow up there or continue with a new request.
                  </p>
                </div>
              </div>
            )}
            <label>
              Category
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea
                placeholder="Include what you were trying to do, what happened, and any error messages."
                rows={6}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
            <label className="file-input">
              <Paperclip size={19} />
              <span>
                <strong>Add attachments</strong>
                <small>
                  Up to five files. Only filenames are saved in this demo.
                </small>
              </span>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  setFiles(
                    [
                      ...new Set([
                        ...files,
                        ...Array.from(e.target.files ?? [], (f) => f.name),
                      ]),
                    ].slice(0, 5),
                  );
                  e.target.value = "";
                }}
              />
            </label>
            {files.map((file) => (
              <div className="attachment" key={file}>
                <File size={16} />
                {file}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={"Remove " + file}
                  onClick={() => setFiles(files.filter((f) => f !== file))}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Link className="btn" href="/customer/tickets">
                Cancel
              </Link>
              <button className="btn primary">
                <Send size={16} /> Submit ticket
              </button>
            </div>
          </form>
        </Panel>
        <div>
          <Panel title="Smart routing" subtitle="Simulated automation preview">
            <div className="panel-body form-stack">
              <div className="callout purple">
                <Sparkles size={18} />
                <div>
                  <strong>Detected priority</strong>
                  <p>
                    {subject.trim() || description.trim() ? (
                      <>
                        <Badge>{detection.priority}</Badge> {detection.reason}
                      </>
                    ) : (
                      "Add a subject or description to see a priority estimate."
                    )}
                  </p>
                </div>
              </div>
              <p className="muted">
                RelayDesk creates a ticket ID, starts the SLA timer, and looks
                for an available agent with room in their queue.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

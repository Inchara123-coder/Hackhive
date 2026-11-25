import { notFound } from "next/navigation";
import { Workspace } from "@/components/layout/workspace";
import { roles, type Role } from "@/types";

export default async function RolePage({
  params,
}: {
  params: Promise<{ role: string; section?: string[] }>;
}) {
  const { role, section = [] } = await params;
  if (
    !roles.includes(role as Role) ||
    section.length > 2 ||
    (section.length === 2 && section[0] !== "tickets")
  )
    notFound();
  return (
    <Workspace
      role={role as Role}
      section={section[0] ?? "dashboard"}
      ticketId={section[1]}
    />
  );
}

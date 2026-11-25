import {
  Bell,
  BookOpen,
  ClipboardList,
  Clock3,
  Gauge,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareText,
  Plus,
  Settings,
  UserRound,
  UsersRound,
  Zap,
  ChartNoAxesCombined,
} from "lucide-react";

export const menus = {
  admin: [
    {
      label: "WORKSPACE",
      items: [
        { name: "Overview", path: "dashboard", icon: LayoutDashboard },
        { name: "All Tickets", path: "tickets", icon: ClipboardList },
        { name: "SLA Monitoring", path: "sla-monitoring", icon: Clock3 },
        { name: "SLA Rescue Mode", path: "sla-rescue", icon: Zap },
      ],
    },
    {
      label: "MANAGEMENT",
      items: [
        { name: "Agent Management", path: "agents", icon: Headphones },
        { name: "Customer Management", path: "customers", icon: UsersRound },
        {
          name: "Reports & Analytics",
          path: "analytics",
          icon: ChartNoAxesCombined,
        },
        { name: "Settings", path: "settings", icon: Settings },
      ],
    },
  ],
  customer: [
    {
      label: "SUPPORT",
      items: [
        { name: "Dashboard", path: "dashboard", icon: LayoutDashboard },
        { name: "Create Ticket", path: "create-ticket", icon: Plus },
        { name: "My Tickets", path: "tickets", icon: LifeBuoy },
      ],
    },
    {
      label: "ACCOUNT",
      items: [
        { name: "Notifications", path: "notifications", icon: Bell },
        { name: "Profile", path: "profile", icon: UserRound },
      ],
    },
  ],
  agent: [
    {
      label: "WORKSPACE",
      items: [
        { name: "My Dashboard", path: "dashboard", icon: Gauge },
        { name: "Assigned Tickets", path: "tickets", icon: ClipboardList },
        { name: "Internal Notes", path: "notes", icon: MessageSquareText },
        { name: "Canned Responses", path: "canned-responses", icon: BookOpen },
      ],
    },
    {
      label: "ACCOUNT",
      items: [
        { name: "Notifications", path: "notifications", icon: Bell },
        { name: "Profile", path: "profile", icon: UserRound },
      ],
    },
  ],
};
export const roleNames = {
  admin: "Admin",
  customer: "Customer",
  agent: "Agent",
};

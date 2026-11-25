"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { DAY } from "@/lib/mock-data";
import { dateLabel, workload } from "@/lib/utils";
import { categories, priorities, type Agent, type Ticket } from "@/types";

const colors = ["#ed6677", "#ffab62", "#7560ee", "#a9a0f6"];
const tooltip = {
  borderRadius: 10,
  border: "1px solid #e9e6f3",
  boxShadow: "0 4px 20px #20194412",
  fontSize: 12,
};
export function TicketActivity({
  tickets,
  now,
}: {
  tickets: Ticket[];
  now: number;
}) {
  const [range, setRange] = useState(7);
  const gradient = useId().replace(/:/g, "");
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const step = range === 30 ? 3 : range === 14 ? 2 : 1;
  const data = Array.from({ length: range / step }, (_, i) => {
    const start = end.getTime() - (range - 1 - i * step) * DAY;
    const inRange = (at: number) =>
      at >= start && at < start + step * DAY && at <= now;
    return {
      date: dateLabel(start),
      Created: tickets.filter((t) => inRange(t.createdAt)).length,
      Resolved: tickets.filter((t) => t.resolvedAt && inRange(t.resolvedAt))
        .length,
    };
  });
  return (
    <Panel
      title="Ticket activity"
      subtitle="Created and resolved tickets over time"
      actions={
        <label className="select-chip">
          <select
            aria-label="Activity date range"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <ChevronDown size={13} />
        </label>
      }
    >
      <div className="chart-legend">
        <span>
          <i /> Tickets created
        </span>
        <span>
          <i /> Tickets resolved
        </span>
      </div>
      <div className="activity-chart" aria-label="Ticket activity chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ left: -21, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8465f9" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#8465f9" stopOpacity={0.025} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#efedf5"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={11}
              minTickGap={13}
              tick={{ fill: "#777589", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#777589", fontSize: 11 }}
            />
            <Tooltip contentStyle={tooltip} />
            <Area
              type="monotone"
              dataKey="Created"
              stroke="#795cf0"
              fill={"url(#" + gradient + ")"}
              strokeWidth={2.7}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="Resolved"
              stroke="#29b9a3"
              fill="#2bbca7"
              fillOpacity={0.07}
              strokeWidth={2.3}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
export function PriorityChart({ tickets }: { tickets: Ticket[] }) {
  const data = priorities.map((name, i) => ({
    name,
    value: tickets.filter((t) => t.priority === name).length,
    fill: colors[i],
  }));
  return (
    <Panel
      title="Tickets by priority"
      subtitle="Breakdown of all support requests"
    >
      <div className="priority-layout">
        <div className="donut" aria-label="Ticket priority breakdown">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="71%"
                outerRadius="92%"
                cornerRadius={5}
                paddingAngle={4}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-label">
            <strong>{tickets.length}</strong>
            <small>Total tickets</small>
          </div>
        </div>
        <div className="priority-legend">
          {data.map((d) => (
            <div key={d.name}>
              <span>
                <i style={{ background: d.fill }} />
                {d.name}
              </span>
              <strong>{d.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
function SimpleBar({
  title,
  subtitle,
  data,
  fill,
}: {
  title: string;
  subtitle: string;
  data: { name: string; count: number }[];
  fill: string;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="bar-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -21, right: 7 }}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="4 4"
              stroke="#eeebf5"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#777589" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#777589" }}
            />
            <Tooltip contentStyle={tooltip} />
            <Bar
              dataKey="count"
              name="Tickets"
              fill={fill}
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
export function CategoryChart({ tickets }: { tickets: Ticket[] }) {
  return (
    <SimpleBar
      title="Tickets by category"
      subtitle="What customers contact support about"
      data={categories.map((name) => ({
        name,
        count: tickets.filter((t) => t.category === name).length,
      }))}
      fill="#8267ef"
    />
  );
}
export function WorkloadChart({
  tickets,
  agents,
}: {
  tickets: Ticket[];
  agents: Agent[];
}) {
  return (
    <SimpleBar
      title="Agent workload"
      subtitle="Unresolved tickets per agent"
      data={agents.map((a) => ({
        name: a.name.split(" ")[0],
        count: workload(tickets, a.id),
      }))}
      fill="#31b9a4"
    />
  );
}
export function ComplianceChart({
  met,
  total,
}: {
  met: number;
  total: number;
}) {
  const percentage = total ? Math.round((met / total) * 100) : 0;
  return (
    <Panel
      title="SLA compliance"
      subtitle="Resolved tickets completed within their SLA"
    >
      <div className="compliance">
        <div className="donut" aria-label={percentage + "% SLA compliance"}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "Met SLA", value: met, fill: "#30b9a3" },
                  { name: "Missed SLA", value: total - met, fill: "#f1edf8" },
                ]}
                dataKey="value"
                innerRadius="72%"
                outerRadius="92%"
                stroke="none"
              />
              <Tooltip contentStyle={tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-label">
            <strong>{percentage}%</strong>
            <small>Compliance</small>
          </div>
        </div>
        <p className="muted">
          {met} of {total} resolved within target
        </p>
      </div>
    </Panel>
  );
}

import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import type { Role } from "@prisma/client";

type SocketIdentity = { id: string; role: Role };
let socketServer: Server | undefined;

export function initSockets(server: HttpServer) {
  socketServer = new Server(server, {
    cors: { origin: env.FRONTEND_ORIGIN, credentials: true },
  });
  socketServer.use(async (socket, next) => {
    const cookie = socket.handshake.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("smartsla_token="))
      ?.slice("smartsla_token=".length);
    const token = (socket.handshake.auth.token as string | undefined) ?? cookie;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: "smartsla-api",
        audience: "smartsla-frontend",
      }) as jwt.JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, active: true },
      });
      if (!user?.active) return next(new Error("Account unavailable"));
      socket.data.identity = { id: user.id, role: user.role } satisfies SocketIdentity;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Invalid token"));
    }
  });
  socketServer.on("connection", (socket) => {
    const identity = socket.data.identity as SocketIdentity;
    socket.join(`user:${identity.id}`);
    socket.on("ticket:join", async (publicId: string) => {
      if (typeof publicId !== "string" || publicId.length > 24) return;
      const ticket = await prisma.ticket.findUnique({
        where: { publicId },
        select: { id: true, customerId: true, assignedAgentId: true },
      });
      if (!ticket) return;
      const allowed =
        identity.role === "ADMIN" ||
        ticket.customerId === identity.id ||
        ticket.assignedAgentId === identity.id;
      if (allowed) socket.join(`ticket:${ticket.id}`);
    });
    socket.on("ticket:leave", async (publicId: string) => {
      const ticket = await prisma.ticket.findUnique({
        where: { publicId },
        select: { id: true },
      });
      if (ticket) socket.leave(`ticket:${ticket.id}`);
    });
  });
  return socketServer;
}

export function io() {
  if (!socketServer) throw new Error("Socket.IO has not been initialized.");
  return socketServer;
}

export function emitIfReady(room: string, event: string, payload: unknown) {
  socketServer?.to(room).emit(event, payload);
}

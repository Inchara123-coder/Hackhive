import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { routeParam } from "../lib/route-param";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const [total, notifications] = await prisma.$transaction([
    prisma.notification.count({ where: { userId: req.user!.id } }),
    prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({ notifications, page, limit, total });
});
notificationsRouter.patch("/:id/read", async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: z.uuid().parse(routeParam(req, "id")), userId: req.user!.id },
    data: { isRead: true, readAt: new Date() },
  });
  res.json({ updated: notification.count });
});
notificationsRouter.post("/read-all", async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  res.json({ updated: result.count });
});

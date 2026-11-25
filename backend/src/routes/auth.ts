import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema, profileSchema, registerSchema } from "../validators/schemas";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  const { name, email, password, phoneNumber } = req.body as {
    name: string;
    email: string;
    password: string;
    phoneNumber?: string;
  };
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, phoneNumber, role: "CUSTOMER" },
    select: { id: true, name: true, email: true, role: true },
  });
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user });
});

authRouter.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash)))
    throw new HttpError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  setAuthCookie(res, signToken(user));
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

authRouter.get("/session", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.patch("/me", requireAuth, validateBody(profileSchema), async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: req.body as { name?: string; phoneNumber?: string | null },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  res.json({ user });
});

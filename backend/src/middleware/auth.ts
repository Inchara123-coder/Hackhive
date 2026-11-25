import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import type { Role } from "@prisma/client";

type TokenPayload = JwtPayload & { role: Role };

function tokenFromRequest(req: Request) {
  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return req.cookies?.smartsla_token as string | undefined;
}

export function signToken(user: { id: string; role: Role }) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: "smartsla-api",
    audience: "smartsla-frontend",
  });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie("smartsla_token", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("smartsla_token", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = tokenFromRequest(req);
  if (!token) return next(new HttpError(401, "Sign in is required.", "UNAUTHENTICATED"));

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "smartsla-api",
      audience: "smartsla-frontend",
    }) as TokenPayload;
  } catch {
    return next(new HttpError(401, "Your session is invalid or expired.", "INVALID_TOKEN"));
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true, name: true, active: true },
  });
  if (!user?.active)
    return next(new HttpError(401, "This account is unavailable.", "ACCOUNT_INACTIVE"));
  req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
  next();
}

export function allowRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Sign in is required.", "UNAUTHENTICATED"));
    if (!roles.includes(req.user.role))
      return next(new HttpError(403, "You do not have permission for this action.", "FORBIDDEN"));
    next();
  };
}

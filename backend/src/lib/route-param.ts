import type { Request } from "express";
import { HttpError } from "./http-error";

export function routeParam(req: Request, name: string) {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0)
    throw new HttpError(400, "A route parameter is invalid.", "INVALID_ROUTE_PARAMETER");
  return value;
}

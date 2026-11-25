import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export const validateBody = (schema: ZodType): RequestHandler =>
  async (req, _res, next) => {
    req.body = await schema.parseAsync(req.body);
    next();
  };

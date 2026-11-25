import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: "Some fields are invalid.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
        message: tooLarge ? "The attachment exceeds the upload size limit." : "The attachment could not be uploaded.",
      },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        error: { code: "CONFLICT", message: "A record with these details already exists." },
      });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "The requested record was not found." },
      });
      return;
    }
  }
  console.error("Unhandled API error", error);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
  });
};

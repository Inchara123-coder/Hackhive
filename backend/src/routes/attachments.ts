import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { accessibleTicket } from "../services/ticket-access";
import { routeParam } from "../lib/route-param";

const allowed = new Map([
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".txt", "text/plain"],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowed.get(extension) !== file.mimetype)
      return callback(new HttpError(415, "Only PDF, PNG, JPEG, and TXT attachments are allowed.", "UNSUPPORTED_FILE"));
    callback(null, true);
  },
});

export const attachmentsRouter = Router({ mergeParams: true });
attachmentsRouter.use(requireAuth);

function hasExpectedSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (mimeType === "image/png")
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg")
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return mimeType === "text/plain" && !buffer.includes(0);
}

attachmentsRouter.post("/", upload.single("file"), async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  if (!req.file) throw new HttpError(400, "Choose an attachment to upload.", "FILE_REQUIRED");
  if (!hasExpectedSignature(req.file.buffer, req.file.mimetype))
    throw new HttpError(415, "The attachment content does not match its file type.", "INVALID_FILE_CONTENT");
  const extension = path.extname(req.file.originalname).toLowerCase();
  const storageName = randomUUID() + extension;
  const originalName = path
    .basename(req.file.originalname)
    .replace(/[\\/\r\n\0]/g, "_")
    .slice(0, 255);
  const directory = path.resolve(env.UPLOAD_DIR);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storageName), req.file.buffer, { flag: "wx" });
  let attachment;
  try {
    attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: req.user!.id,
        originalName,
        storageName,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
  } catch (error) {
    await unlink(path.join(directory, storageName));
    throw error;
  }
  res.status(201).json({ attachment });
});

attachmentsRouter.get("/:attachmentId", async (req, res) => {
  const ticket = await accessibleTicket(routeParam(req, "publicId"), req);
  const attachment = await prisma.attachment.findFirst({
    where: { id: routeParam(req, "attachmentId"), ticketId: ticket.id },
    select: { storageName: true, originalName: true },
  });
  if (!attachment) throw new HttpError(404, "Attachment not found.", "NOT_FOUND");
  res.download(path.resolve(env.UPLOAD_DIR, attachment.storageName), attachment.originalName);
});

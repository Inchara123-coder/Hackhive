import { randomBytes } from "node:crypto";

export function newPublicId() {
  return "SSL-" + randomBytes(5).toString("hex").toUpperCase();
}

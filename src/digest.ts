import { createHash } from "node:crypto";

export function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

export function fullSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

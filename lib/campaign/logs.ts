import path from "path";

const LOG_PREFIX = "logs-SENT";
const LOG_SUFFIX = ".txt";
const LOG_FILENAME_PATTERN = /^logs-SENT-\d{2}-\d{2}-\d{4}(?:-[A-Za-z0-9._-]{1,80})?\.txt$/;

export function sanitizeLogLabel(value?: string): string | null {
  if (!value) return null;
  const baseName = path.parse(value).name || value;
  // Keep the label filesystem-safe and ASCII-only.
  const cleaned = baseName
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return cleaned ? cleaned.slice(0, 80) : null;
}

export function buildLogFilename(leadsFilename?: string, now: Date = new Date()): string {
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const label = sanitizeLogLabel(leadsFilename);
  const suffix = label ? `-${label}` : "";
  return `${LOG_PREFIX}-${day}-${month}-${year}${suffix}${LOG_SUFFIX}`;
}

export function isValidLogFilename(filename: string): boolean {
  return LOG_FILENAME_PATTERN.test(filename);
}

export function getLogFilePath(filename: string): string {
  return path.join(process.cwd(), filename);
}

import fs from "fs";
import path from "path";
import { Writable } from "stream";
import pino, { type Logger, type LoggerOptions } from "pino";
import { resolveRequestId } from "../resolve-request-id";

// [Reason] Centralize log output under logs/nextjs for rotation and ops tooling
export const LOG_DIR = path.join(process.cwd(), "logs", "nextjs");

export type LoggerKind = "app" | "access" | "error";

type PinoDestination = ReturnType<typeof pino.destination>;

// [Reason] Daily filenames use the server local calendar date (YYYY-MM-DD.log)
function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// [Reason] Route each logger kind to its own subdirectory with a date-based file
function getDailyLogPath(kind: LoggerKind, date = new Date()): string {
  const dateKey = getLocalDateString(date);
  return path.join(LOG_DIR, kind, `${dateKey}.log`);
}

// [Reason] Create kind subdirectory before opening the daily log file
function ensureLogDirForKind(kind: LoggerKind): void {
  try {
    fs.mkdirSync(path.join(LOG_DIR, kind), { recursive: true });
  } catch {
    // Never throw from logger setup
  }
}

// [Reason] Open the correct daily file on each write so logs roll over at midnight without restart
class DailyRotatingFileStream extends Writable {
  private activeDate: string | null = null;
  private destination: PinoDestination | null = null;

  constructor(private readonly kind: LoggerKind) {
    super();
  }

  private openDestinationForToday(): void {
    const today = getLocalDateString();
    const filePath = getDailyLogPath(this.kind);
    if (this.activeDate === today && this.destination) {
      // [Reason] Reopen when the daily file was deleted while the server still holds the old handle
      if (fs.existsSync(filePath)) {
        return;
      }
      try {
        this.destination.end();
      } catch {
        // Best-effort close before reopening after external deletion
      }
      this.destination = null;
    }

    if (this.destination) {
      try {
        this.destination.end();
      } catch {
        // Best-effort close when rolling to the next day's file
      }
      this.destination = null;
    }

    ensureLogDirForKind(this.kind);
    this.destination = pino.destination({ dest: filePath, sync: false });
    this.activeDate = today;
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.openDestinationForToday();
      // [Reason] Removed temporary debug instrumentation after confirming fix
      const dest = this.destination;
      if (!dest) {
        callback();
        return;
      }
      const line = typeof chunk === "string" ? chunk : chunk.toString();
      const accepted = dest.write(line);
      if (!accepted) {
        dest.once("drain", () => callback());
        return;
      }
      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    try {
      this.destination?.end();
      this.destination = null;
      this.activeDate = null;
      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export type CreateLoggerOptions = {
  kind: LoggerKind;
  level?: LoggerOptions["level"];
  extra?: LoggerOptions;
};

// [Reason] Single factory so app/access/error loggers share transport and naming rules
export function createLogger(options: CreateLoggerOptions): Logger {
  const { kind, level = "info", extra } = options;
  const fileStream = new DailyRotatingFileStream(kind);

  const isDev = process.env.NODE_ENV !== "production";
  const streams = isDev
    ? [
        { stream: fileStream },
        {
          stream: pino.transport({
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard" },
          }),
        },
      ]
    : [{ stream: fileStream }];

  return pino(
    {
      name: kind,
      level,
      // [Reason] Omit default pid/hostname bindings from access, app, and error log lines
      base: undefined,
      // [Reason] Attach requestId from ALS or middleware-forwarded headers without changing caller APIs
      mixin() {
        const requestId = resolveRequestId();
        return requestId ? { requestId } : {};
      },
      ...extra,
    },
    pino.multistream(streams)
  );
}

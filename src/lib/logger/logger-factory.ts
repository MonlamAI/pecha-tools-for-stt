import fs from "fs";
import path from "path";
import { Writable } from "stream";
import pino, { type Logger, type LoggerOptions } from "pino";
import { resolveRequestId } from "../resolve-request-id";

// [Reason] Centralize log output under logs/nextjs for rotation and ops tooling
export const LOG_DIR = path.join(process.cwd(), "logs", "nextjs");

export type LoggerKind = "app" | "access" | "error";

type PinoDestination = ReturnType<typeof pino.destination>;
type LokiValueTuple = [string, string];

// [Reason] Provide safe defaults while still allowing environment-based Loki configuration.
const DEFAULT_LOKI_URL = "http://13.233.212.15:3100/loki/api/v1/push";
// [Reason] Keep tenant handling explicit for single-tenant and multi-tenant Loki deployments.
const DEFAULT_LOKI_TENANT_ID = "fake";
// [Reason] Bound in-memory buffering to avoid unbounded growth if Loki is unavailable.
const LOKI_MAX_QUEUE_SIZE = 10_000;
// [Reason] Batch writes to reduce network overhead while keeping near-real-time delivery.
const LOKI_BATCH_SIZE = 200;
// [Reason] Keep retries finite so permanently bad payloads do not loop forever.
const LOKI_MAX_RETRIES = 5;
// [Reason] Use exponential backoff base delay for transient Loki delivery failures.
const LOKI_BASE_BACKOFF_MS = 250;
// [Reason] Add backoff ceiling to keep retries responsive under prolonged outages.
const LOKI_MAX_BACKOFF_MS = 5_000;

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

type LokiQueueItem = {
  line: string;
  timestampNs: string;
  attempt: number;
};

// [Reason] Push existing JSON log lines to Loki asynchronously without changing caller APIs or file logging.
class LokiAsyncStream extends Writable {
  private readonly queue: LokiQueueItem[] = [];
  private isFlushing = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly lokiUrl: string;
  private readonly tenantId: string;

  constructor(private readonly kind: LoggerKind) {
    super();
    // [Reason] Pull runtime Loki URL from environment to support deployment-specific endpoints.
    this.lokiUrl = process.env.LOKI_URL || DEFAULT_LOKI_URL;
    // [Reason] Pull runtime tenant ID from environment for Loki auth/routing headers.
    this.tenantId = process.env.LOKI_TENANT_ID || DEFAULT_LOKI_TENANT_ID;
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      const line = typeof chunk === "string" ? chunk : chunk.toString(encoding);
      this.enqueue({
        line,
        // [Reason] Loki expects timestamps in nanoseconds as a string.
        timestampNs: `${Date.now()}000000`,
        attempt: 0,
      });
      // [Reason] Never block request/response flow on external log delivery.
      callback();
    } catch {
      // [Reason] Logger failures must never interrupt application execution.
      callback();
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    // [Reason] Clear pending timers during shutdown to avoid dangling async work.
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    callback();
  }

  private enqueue(item: LokiQueueItem): void {
    // [Reason] Drop oldest entries under sustained backpressure to protect process memory.
    if (this.queue.length >= LOKI_MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
    this.queue.push(item);
    this.scheduleFlush(0);
  }

  private scheduleFlush(delayMs: number): void {
    // [Reason] Avoid overlapping timers while preserving earliest required flush.
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushOnce();
    }, delayMs);
  }

  private async flushOnce(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }
    this.isFlushing = true;

    const batch = this.queue.splice(0, LOKI_BATCH_SIZE);
    const values: LokiValueTuple[] = batch.map((item) => [item.timestampNs, item.line]);

    try {
      await this.pushToLoki(values);
    } catch {
      // [Reason] Retry only transient failures with exponential backoff.
      for (const item of batch) {
        if (item.attempt + 1 > LOKI_MAX_RETRIES) {
          continue;
        }
        const retried: LokiQueueItem = { ...item, attempt: item.attempt + 1 };
        this.queue.unshift(retried);
      }

      if (batch.length > 0) {
        const nextAttempt = (batch[0]?.attempt ?? 0) + 1;
        const cappedAttempt = Math.min(nextAttempt, LOKI_MAX_RETRIES);
        const backoff = Math.min(
          LOKI_BASE_BACKOFF_MS * 2 ** Math.max(cappedAttempt - 1, 0),
          LOKI_MAX_BACKOFF_MS
        );
        this.isFlushing = false;
        this.scheduleFlush(backoff);
        return;
      }
    }

    this.isFlushing = false;
    if (this.queue.length > 0) {
      this.scheduleFlush(0);
    }
  }

  private async pushToLoki(values: LokiValueTuple[]): Promise<void> {
    const response = await fetch(this.lokiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Scope-OrgID": this.tenantId,
      },
      body: JSON.stringify({
        streams: [
          {
            stream: {
              app: "nextjs",
              log_kind: this.kind,
            },
            values,
          },
        ],
      }),
    });

    // [Reason] Retry on transient Loki/network pressure responses and drop permanent failures.
    if (response.status >= 500 || response.status === 429) {
      throw new Error(`Transient Loki response: ${response.status}`);
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
  // [Reason] Keep per-kind Loki labeling aligned with existing access/app/error channel separation.
  const lokiStream = new LokiAsyncStream(kind);

  const isDev = process.env.NODE_ENV !== "production";
  const streams = isDev
    ? [
        { stream: fileStream },
        { stream: lokiStream },
        {
          stream: pino.transport({
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard" },
          }),
        },
      ]
    : [{ stream: fileStream }, { stream: lokiStream }];

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

import fs from "fs";
import path from "path";
import { appLogger } from "../src/lib/logger/app-logger";
import { LOG_DIR } from "../src/lib/logger/logger-factory";

type LogKind = "access" | "app" | "error";

// [Reason] Retention windows per log channel as defined by ops policy
const RETENTION_DAYS: Record<LogKind, number> = {
  access: 14,
  app: 14,
  error: 30,
};

const LOG_KINDS: LogKind[] = ["access", "app", "error"];
const LOG_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.log$/;

type CleanupAction = {
  kind: LogKind;
  filename: string;
  filePath: string;
};

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

function getTodayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// [Reason] Only YYYY-MM-DD.log files are eligible for retention cleanup
function parseLogFileDate(filename: string): string | null {
  const match = filename.match(LOG_FILE_PATTERN);
  if (!match) {
    return null;
  }

  const dateKey = match[1];
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return dateKey;
}

function isOlderThanRetention(fileDateKey: string, retentionDays: number, todayKey: string): boolean {
  const fileDate = new Date(`${fileDateKey}T00:00:00`);
  const todayDate = new Date(`${todayKey}T00:00:00`);
  const cutoffDate = new Date(todayDate);
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  return fileDate < cutoffDate;
}

// [Reason] Scan one log kind directory and collect files eligible for deletion
function collectCleanupActions(kind: LogKind, todayKey: string): CleanupAction[] {
  const kindDir = path.join(LOG_DIR, kind);
  const actions: CleanupAction[] = [];

  if (!fs.existsSync(kindDir)) {
    return actions;
  }

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(kindDir);
  } catch (error) {
    appLogger.warn(
      {
        kind,
        directory: kindDir,
        error: error instanceof Error ? error.message : String(error),
      },
      "log_cleanup_read_dir_failed"
    );
    return actions;
  }

  for (const filename of entries) {
    if (filename === ".gitkeep") {
      continue;
    }

    const fileDateKey = parseLogFileDate(filename);
    if (!fileDateKey) {
      continue;
    }

    if (fileDateKey >= todayKey) {
      continue;
    }

    if (!isOlderThanRetention(fileDateKey, RETENTION_DAYS[kind], todayKey)) {
      continue;
    }

    actions.push({
      kind,
      filename,
      filePath: path.join(kindDir, filename),
    });
  }

  return actions;
}

// [Reason] Delete expired daily logs without crashing on permission or missing-file errors
function deleteLogFile(action: CleanupAction): boolean {
  try {
    fs.unlinkSync(action.filePath);
    return true;
  } catch (error) {
    appLogger.warn(
      {
        kind: action.kind,
        filePath: action.filePath,
        error: error instanceof Error ? error.message : String(error),
      },
      "log_cleanup_delete_failed"
    );
    return false;
  }
}

function runCleanup(dryRun: boolean): void {
  const todayKey = getTodayKey();
  const actions = LOG_KINDS.flatMap((kind) => collectCleanupActions(kind, todayKey));

  if (actions.length === 0) {
    console.log("No log files eligible for cleanup.");
    appLogger.info({ dryRun, todayKey, deletedCount: 0 }, "log_cleanup_completed");
    return;
  }

  if (dryRun) {
    console.log("Would delete:");
    for (const action of actions) {
      console.log(`${action.kind}/${action.filename}`);
    }
    appLogger.info(
      {
        dryRun: true,
        todayKey,
        wouldDelete: actions.map((action) => `${action.kind}/${action.filename}`),
      },
      "log_cleanup_dry_run"
    );
    return;
  }

  console.log("Deleted:");
  let deletedCount = 0;
  const deletedFiles: string[] = [];
  for (const action of actions) {
    if (deleteLogFile(action)) {
      deletedCount += 1;
      deletedFiles.push(action.filePath);
      console.log(action.filePath);
    }
  }

  appLogger.info(
    {
      dryRun: false,
      todayKey,
      deletedCount,
      deletedFiles,
    },
    "log_cleanup_completed"
  );
}

const { dryRun } = parseArgs(process.argv.slice(2));
runCleanup(dryRun);

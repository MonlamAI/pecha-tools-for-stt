import { createLogger } from "./logger-factory";

// [Reason] Default application logger for general server-side events
export const appLogger = createLogger({ kind: "app", level: "info" });

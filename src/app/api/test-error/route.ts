// src/app/api/test-error/route.ts

import { appLogger } from "@/lib/logger";
import { withAccessLog } from "@/lib/logger/with-access-log";

// [Reason] Validate that thrown exceptions produce access+error logs and are rethrown to Next.js
export const GET = withAccessLog(async () => {
  appLogger.info({ test: true }, "before-error");
  throw new Error("logging_test_error");
});
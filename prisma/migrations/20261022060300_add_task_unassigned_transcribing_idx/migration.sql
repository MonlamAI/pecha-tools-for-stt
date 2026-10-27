-- Partial index (not expressible in schema.prisma): unassigned transcriber queue for assignTasksToUser.
CREATE INDEX CONCURRENTLY "Task_unassigned_transcribing_idx" ON "Task"("group_id", "id") WHERE "state" = 'transcribing' AND "transcriber_id" IS NULL;

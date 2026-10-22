-- Partial index (not expressible in schema.prisma): unassigned reviewer queue for assignTasksToUser.
CREATE INDEX CONCURRENTLY "Task_unassigned_submitted_idx" ON "Task"("group_id", "id") WHERE "state" = 'submitted' AND "reviewer_id" IS NULL;

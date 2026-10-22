-- Partial index (not expressible in schema.prisma): unassigned final-reviewer queue for assignTasksToUser.
CREATE INDEX CONCURRENTLY "Task_unassigned_accepted_idx" ON "Task"("group_id", "id") WHERE "state" = 'accepted' AND "final_reviewer_id" IS NULL;

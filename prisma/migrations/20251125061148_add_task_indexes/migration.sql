

-- CreateIndex
CREATE INDEX "Task_group_id_state_idx" ON "Task"("group_id", "state");

-- CreateIndex
CREATE INDEX "Task_state_idx" ON "Task"("state");

-- CreateIndex
CREATE INDEX "Task_transcriber_id_state_idx" ON "Task"("transcriber_id", "state");

-- CreateIndex
CREATE INDEX "Task_reviewer_id_state_idx" ON "Task"("reviewer_id", "state");

-- CreateIndex
CREATE INDEX "Task_final_reviewer_id_state_idx" ON "Task"("final_reviewer_id", "state");

-- CreateIndex
CREATE INDEX "Task_transcriber_id_submitted_at_idx" ON "Task"("transcriber_id", "submitted_at");

-- CreateIndex
CREATE INDEX "Task_reviewer_id_reviewed_at_idx" ON "Task"("reviewer_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "Task_final_reviewer_id_finalised_reviewed_at_idx" ON "Task"("final_reviewer_id", "finalised_reviewed_at");

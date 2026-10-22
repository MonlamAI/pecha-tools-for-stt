-- Serves getTasks for final reviewers: final_reviewer_id + group_id + state, ordered by id.
CREATE INDEX CONCURRENTLY "Task_final_reviewer_id_group_id_state_id_idx" ON "Task"("final_reviewer_id", "group_id", "state", "id");

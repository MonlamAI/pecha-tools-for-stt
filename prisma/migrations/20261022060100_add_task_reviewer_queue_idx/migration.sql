-- Serves getTasks for reviewers: reviewer_id + group_id + state, ordered by id.
CREATE INDEX CONCURRENTLY "Task_reviewer_id_group_id_state_id_idx" ON "Task"("reviewer_id", "group_id", "state", "id");

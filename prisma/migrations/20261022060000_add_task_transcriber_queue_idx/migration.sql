-- Serves getTasks for transcribers: transcriber_id + group_id + state, ordered by id.
CREATE INDEX CONCURRENTLY "Task_transcriber_id_group_id_state_id_idx" ON "Task"("transcriber_id", "group_id", "state", "id");

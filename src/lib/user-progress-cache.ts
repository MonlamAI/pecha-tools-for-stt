import type { Role, State } from "@prisma/client";
import { TASK_RULES } from "@/constants/taskRules";
import { bumpCacheWriteVersion, getCache, getCacheWriteVersion, setCache } from "@/lib/cache";

// [Reason] Short TTL keeps sidebar fresh while targeted deltas avoid DB hits after each action
export const USER_PROGRESS_CACHE_TTL_MS = 5_000;

export type UserProgressStats = {
  completedTaskCount: number;
  totalTaskCount: number;
  totalTaskPassed: number;
  rejectedTaskCount: number;
};

export type TaskProgressSnapshot = {
  state: State;
  group_id: number;
  transcriber_id: number | null;
  reviewer_id: number | null;
  final_reviewer_id: number | null;
};

const ZERO_STATS: UserProgressStats = {
  completedTaskCount: 0,
  totalTaskCount: 0,
  totalTaskPassed: 0,
  rejectedTaskCount: 0,
};

// [Reason] Single key format shared by progress reads and task-action cache updates
export function buildUserProgressCacheKey(
  userId: number,
  groupId: number,
  role: Role
): string {
  return `user_progress:${userId}:${groupId}:${role}`;
}

function inStates(state: State, states: State | State[]): boolean {
  const list = Array.isArray(states) ? states : [states];
  return list.includes(state);
}

// [Reason] Mirror grouped SQL progress rules so cache deltas stay aligned with DB counts
export function computeTaskProgressContribution(
  task: TaskProgressSnapshot,
  role: Role,
  userId: number,
  groupId: number
): UserProgressStats {
  if (task.group_id !== groupId) {
    return { ...ZERO_STATS };
  }

  const rule = TASK_RULES[role];
  const ownerId = task[rule.idField as keyof TaskProgressSnapshot];
  if (ownerId !== userId) {
    return { ...ZERO_STATS };
  }

  let rejectedTaskCount = 0;
  if (role === "TRANSCRIBER") {
    rejectedTaskCount =
      task.state === rule.workingState && task.reviewer_id != null ? 1 : 0;
  } else if (role === "REVIEWER") {
    rejectedTaskCount =
      task.state === rule.workingState && task.final_reviewer_id != null ? 1 : 0;
  }

  return {
    completedTaskCount: inStates(task.state, rule.completedStates) ? 1 : 0,
    totalTaskCount: 1,
    totalTaskPassed: inStates(task.state, rule.passedStates) ? 1 : 0,
    rejectedTaskCount,
  };
}

export function toTaskProgressSnapshot(task: {
  state: State;
  group_id: number;
  transcriber_id?: number | null;
  reviewer_id?: number | null;
  final_reviewer_id?: number | null;
}): TaskProgressSnapshot {
  return {
    state: task.state,
    group_id: task.group_id,
    transcriber_id: task.transcriber_id ?? null,
    reviewer_id: task.reviewer_id ?? null,
    final_reviewer_id: task.final_reviewer_id ?? null,
  };
}

function uniqueProgressOwners(
  owners: Array<{ userId: number; role: Role; groupId: number }>
): Array<{ userId: number; role: Role; groupId: number }> {
  const seen = new Set<string>();
  const unique: Array<{ userId: number; role: Role; groupId: number }> = [];
  for (const owner of owners) {
    const key = `${owner.userId}:${owner.groupId}:${owner.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(owner);
  }
  return unique;
}

export function getAffectedProgressOwners(
  task: TaskProgressSnapshot
): Array<{ userId: number; role: Role; groupId: number }> {
  const owners: Array<{ userId: number; role: Role; groupId: number }> = [];
  if (task.transcriber_id != null) {
    owners.push({
      userId: task.transcriber_id,
      role: "TRANSCRIBER",
      groupId: task.group_id,
    });
  }
  if (task.reviewer_id != null) {
    owners.push({
      userId: task.reviewer_id,
      role: "REVIEWER",
      groupId: task.group_id,
    });
  }
  if (task.final_reviewer_id != null) {
    owners.push({
      userId: task.final_reviewer_id,
      role: "FINAL_REVIEWER",
      groupId: task.group_id,
    });
  }
  return owners;
}

function applyDeltaToStats(
  cached: UserProgressStats,
  oldContribution: UserProgressStats,
  newContribution: UserProgressStats
): UserProgressStats {
  return {
    completedTaskCount:
      cached.completedTaskCount -
      oldContribution.completedTaskCount +
      newContribution.completedTaskCount,
    totalTaskCount:
      cached.totalTaskCount -
      oldContribution.totalTaskCount +
      newContribution.totalTaskCount,
    totalTaskPassed:
      cached.totalTaskPassed -
      oldContribution.totalTaskPassed +
      newContribution.totalTaskPassed,
    rejectedTaskCount:
      cached.rejectedTaskCount -
      oldContribution.rejectedTaskCount +
      newContribution.rejectedTaskCount,
  };
}

export function progressSnapshotsEqual(
  before: TaskProgressSnapshot,
  after: TaskProgressSnapshot
): boolean {
  return (
    before.state === after.state &&
    before.group_id === after.group_id &&
    before.transcriber_id === after.transcriber_id &&
    before.reviewer_id === after.reviewer_id &&
    before.final_reviewer_id === after.final_reviewer_id
  );
}

// [Reason] Update cached sidebar counts in-place after state changes instead of invalidating
export function applyTaskTransitionToProgressCache(
  before: TaskProgressSnapshot,
  after: TaskProgressSnapshot
): void {
  if (progressSnapshotsEqual(before, after)) {
    return;
  }

  const owners = uniqueProgressOwners([
    ...getAffectedProgressOwners(before),
    ...getAffectedProgressOwners(after),
  ]);

  for (const owner of owners) {
    const cacheKey = buildUserProgressCacheKey(
      owner.userId,
      owner.groupId,
      owner.role
    );
    const cached = getCache<UserProgressStats>(cacheKey);
    // [Reason] Skip cache rebuild when cold — next progress request loads from DB
    if (!cached) continue;

    const oldContribution = computeTaskProgressContribution(
      before,
      owner.role,
      owner.userId,
      owner.groupId
    );
    const newContribution = computeTaskProgressContribution(
      after,
      owner.role,
      owner.userId,
      owner.groupId
    );

    setCache(
      cacheKey,
      applyDeltaToStats(cached, oldContribution, newContribution),
      USER_PROGRESS_CACHE_TTL_MS
    );
    bumpCacheWriteVersion(cacheKey);
  }
}

// [Reason] Prevent a slow cache-miss DB read from overwriting fresher delta updates
export function setUserProgressCacheIfFresh(
  cacheKey: string,
  stats: UserProgressStats,
  versionAtStart: number
): boolean {
  if (getCacheWriteVersion(cacheKey) !== versionAtStart) {
    return false;
  }
  setCache(cacheKey, stats, USER_PROGRESS_CACHE_TTL_MS);
  return true;
}

export function getCachedUserProgressStats(
  cacheKey: string
): UserProgressStats | undefined {
  return getCache<UserProgressStats>(cacheKey);
}

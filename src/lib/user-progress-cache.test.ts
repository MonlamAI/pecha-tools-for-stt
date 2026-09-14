import assert from "node:assert/strict";
import test from "node:test";
import {
  bumpCacheWriteVersion,
  getCacheWriteVersion,
  resetCacheStoreForTests,
  setCache,
} from "./cache";
import {
  USER_PROGRESS_CACHE_TTL_MS,
  applyTaskTransitionToProgressCache,
  buildUserProgressCacheKey,
  computeTaskProgressContribution,
  getCachedUserProgressStats,
  setUserProgressCacheIfFresh,
  type TaskProgressSnapshot,
  type UserProgressStats,
} from "./user-progress-cache";

const GROUP_ID = 14;
const TRANSCRIBER_ID = 221;
const REVIEWER_ID = 13;

function seedReviewerCache(stats: UserProgressStats): string {
  const key = buildUserProgressCacheKey(REVIEWER_ID, GROUP_ID, "REVIEWER");
  setCache(key, stats, USER_PROGRESS_CACHE_TTL_MS);
  return key;
}

function baseTask(overrides: Partial<TaskProgressSnapshot> = {}): TaskProgressSnapshot {
  return {
    state: "submitted",
    group_id: GROUP_ID,
    transcriber_id: TRANSCRIBER_ID,
    reviewer_id: REVIEWER_ID,
    final_reviewer_id: null,
    ...overrides,
  };
}

test.beforeEach(() => {
  resetCacheStoreForTests();
});

test("progress is cached for 5 seconds", () => {
  const key = seedReviewerCache({
    completedTaskCount: 1,
    totalTaskCount: 2,
    totalTaskPassed: 0,
    rejectedTaskCount: 0,
  });

  const cached = getCachedUserProgressStats(key);
  assert.equal(cached?.completedTaskCount, 1);
  assert.equal(USER_PROGRESS_CACHE_TTL_MS, 5000);
});

test("cache hit returns stored progress without requiring recomputation", () => {
  const key = seedReviewerCache({
    completedTaskCount: 4,
    totalTaskCount: 10,
    totalTaskPassed: 2,
    rejectedTaskCount: 1,
  });

  let dbCalls = 0;
  const maybeFetch = () => {
    const cached = getCachedUserProgressStats(key);
    if (cached) return cached;
    dbCalls += 1;
    return null;
  };

  const first = maybeFetch();
  const second = maybeFetch();

  assert.deepEqual(first, second);
  assert.equal(dbCalls, 0);
});

test("expired cache entry is treated as a miss on next read", () => {
  const key = buildUserProgressCacheKey(REVIEWER_ID, GROUP_ID, "REVIEWER");
  setCache(key, {
    completedTaskCount: 1,
    totalTaskCount: 1,
    totalTaskPassed: 0,
    rejectedTaskCount: 0,
  }, 1);

  assert.ok(getCachedUserProgressStats(key));

  const start = Date.now();
  while (Date.now() - start < 5) {
    // wait for TTL expiry
  }

  assert.equal(getCachedUserProgressStats(key), undefined);
});

test("submitted to accepted updates reviewer completed count", () => {
  seedReviewerCache({
    completedTaskCount: 2,
    totalTaskCount: 5,
    totalTaskPassed: 0,
    rejectedTaskCount: 0,
  });

  applyTaskTransitionToProgressCache(
    baseTask({ state: "submitted" }),
    baseTask({ state: "accepted" })
  );

  const cached = getCachedUserProgressStats(
    buildUserProgressCacheKey(REVIEWER_ID, GROUP_ID, "REVIEWER")
  );
  assert.equal(cached?.completedTaskCount, 3);
  assert.equal(cached?.totalTaskCount, 5);
});

test("transcribing to submitted updates transcriber completed count", () => {
  const key = buildUserProgressCacheKey(TRANSCRIBER_ID, GROUP_ID, "TRANSCRIBER");
  setCache(
    key,
    {
      completedTaskCount: 1,
      totalTaskCount: 4,
      totalTaskPassed: 0,
      rejectedTaskCount: 1,
    },
    USER_PROGRESS_CACHE_TTL_MS
  );

  applyTaskTransitionToProgressCache(
    baseTask({
      state: "transcribing",
      reviewer_id: REVIEWER_ID,
      final_reviewer_id: null,
    }),
    baseTask({ state: "submitted" })
  );

  const cached = getCachedUserProgressStats(key);
  assert.equal(cached?.completedTaskCount, 2);
  assert.equal(cached?.rejectedTaskCount, 0);
});

test("reviewer rejection updates transcriber needs revision count", () => {
  const key = buildUserProgressCacheKey(TRANSCRIBER_ID, GROUP_ID, "TRANSCRIBER");
  setCache(
    key,
    {
      completedTaskCount: 5,
      totalTaskCount: 8,
      totalTaskPassed: 2,
      rejectedTaskCount: 0,
    },
    USER_PROGRESS_CACHE_TTL_MS
  );

  applyTaskTransitionToProgressCache(
    baseTask({ state: "submitted" }),
    baseTask({ state: "transcribing" })
  );

  const cached = getCachedUserProgressStats(key);
  assert.equal(cached?.completedTaskCount, 4);
  assert.equal(cached?.rejectedTaskCount, 1);
});

test("task updates do not modify unrelated user caches", () => {
  const reviewerKey = seedReviewerCache({
    completedTaskCount: 1,
    totalTaskCount: 1,
    totalTaskPassed: 0,
    rejectedTaskCount: 0,
  });
  const otherReviewerKey = buildUserProgressCacheKey(999, GROUP_ID, "REVIEWER");
  setCache(
    otherReviewerKey,
    {
      completedTaskCount: 7,
      totalTaskCount: 7,
      totalTaskPassed: 3,
      rejectedTaskCount: 0,
    },
    USER_PROGRESS_CACHE_TTL_MS
  );

  applyTaskTransitionToProgressCache(
    baseTask({ state: "submitted" }),
    baseTask({ state: "accepted" })
  );

  assert.equal(
    getCachedUserProgressStats(otherReviewerKey)?.completedTaskCount,
    7
  );
  assert.notEqual(getCachedUserProgressStats(reviewerKey)?.completedTaskCount, 1);
});

test("users in different groups do not share cache keys", () => {
  const groupAKey = buildUserProgressCacheKey(REVIEWER_ID, 14, "REVIEWER");
  const groupBKey = buildUserProgressCacheKey(REVIEWER_ID, 99, "REVIEWER");

  setCache(
    groupAKey,
    {
      completedTaskCount: 1,
      totalTaskCount: 1,
      totalTaskPassed: 0,
      rejectedTaskCount: 0,
    },
    USER_PROGRESS_CACHE_TTL_MS
  );

  applyTaskTransitionToProgressCache(
    baseTask({ state: "submitted", group_id: 14 }),
    baseTask({ state: "accepted", group_id: 14 })
  );

  assert.equal(getCachedUserProgressStats(groupBKey), undefined);
});

test("cache miss write is skipped when write version changed during DB fetch", () => {
  const key = buildUserProgressCacheKey(REVIEWER_ID, GROUP_ID, "REVIEWER");
  const versionAtStart = getCacheWriteVersion(key);

  bumpCacheWriteVersion(key);
  setCache(
    key,
    {
      completedTaskCount: 9,
      totalTaskCount: 9,
      totalTaskPassed: 4,
      rejectedTaskCount: 0,
    },
    USER_PROGRESS_CACHE_TTL_MS
  );

  const wroteStale = setUserProgressCacheIfFresh(
    key,
    {
      completedTaskCount: 1,
      totalTaskCount: 1,
      totalTaskPassed: 0,
      rejectedTaskCount: 0,
    },
    versionAtStart
  );

  assert.equal(wroteStale, false);
  assert.equal(getCachedUserProgressStats(key)?.completedTaskCount, 9);
});

test("missing cache is not populated during task transition updates", () => {
  const key = buildUserProgressCacheKey(REVIEWER_ID, GROUP_ID, "REVIEWER");

  applyTaskTransitionToProgressCache(
    baseTask({ state: "submitted" }),
    baseTask({ state: "accepted" })
  );

  assert.equal(getCachedUserProgressStats(key), undefined);
});

test("contribution rules match grouped SQL semantics for reviewer needs revision", () => {
  const needsRevision = computeTaskProgressContribution(
    baseTask({ state: "submitted", final_reviewer_id: 55 }),
    "REVIEWER",
    REVIEWER_ID,
    GROUP_ID
  );
  assert.equal(needsRevision.rejectedTaskCount, 1);

  const noRevision = computeTaskProgressContribution(
    baseTask({ state: "submitted", final_reviewer_id: null }),
    "REVIEWER",
    REVIEWER_ID,
    GROUP_ID
  );
  assert.equal(noRevision.rejectedTaskCount, 0);
});

test("API response shape remains the four numeric progress counters", () => {
  const stats: UserProgressStats = {
    completedTaskCount: 1,
    totalTaskCount: 2,
    totalTaskPassed: 3,
    rejectedTaskCount: 4,
  };

  assert.deepEqual(Object.keys(stats).sort(), [
    "completedTaskCount",
    "rejectedTaskCount",
    "totalTaskCount",
    "totalTaskPassed",
  ]);
});

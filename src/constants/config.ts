// How many tasks to assign per batch
// development
// export const USER_FETCH_TASKS = 20;
// export const ASSIGN_TASKS = 1;



export const USER_FETCH_TASKS = 20;
export const ASSIGN_TASKS = 20;

// How many completed tasks to show in user history
export const MAX_HISTORY = 10;

// Default role if a user is created without one
export const DEFAULT_ROLE = "TRANSCRIBER";

// Default group ID when no group is assigned
export const DEFAULT_GROUP_ID = 0;

export const TASK_ASSIGN = {
  ASSIGN_BUFFER: 6,
  TASK_LEFT_LIMIT: 10,
  THRESHOLD: 3000,
};

// Stats configuration following your established pattern
export const STATS_CONFIG = {
  CACHE_TIME: 300, // 5 minutes like your pattern
  IMPORT_THRESHOLD: 500,
  CONCURRENT_QUERIES: 6, // For Promise.all optimization
};
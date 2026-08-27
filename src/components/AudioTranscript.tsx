"use client";
// [Reason] useCallback needed to give setUserProgress a stable identity so it
// can be safely added to the useEffect dependency array below.
import React, { useState, useRef, useEffect, useCallback } from "react";
import { AudioPlayer } from "./AudioPlayer";
// [Reason] Transcript editor state moved into TranscriptWorkspace to isolate
// keystroke re-renders from AudioTranscript's siblings (Sidebar/AudioPlayer/header).
import TranscriptWorkspace from "./TranscriptWorkspace";
import Sidebar from "@/components/Sidebar";
import toast from "react-hot-toast";
import AppContext from "./AppContext";
import type { Task, User } from "@prisma/client";

// Types
type AudioTranscriptType = {
  tasks: Task[];
  userDetail: User;
  language: any;
  userHistory: Task[];
};

async function fetchUserProgress({ userId, groupId, role }: any) {
  const res = await fetch(
    `/api/user/progress?userId=${userId}&groupId=${groupId}&role=${role}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch user progress");
  return res.json();
}

async function fetchTaskList({
  userId,
  groupId,
  role,
  sourceUserId,
  limit,
}: {
  userId: number;
  groupId: number;
  role: string;
  sourceUserId?: number | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (sourceUserId != null) params.set("sourceUserId", String(sourceUserId));
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();
  const res = await fetch(`/api/task/list${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

type AssignOption = { id: number; name: string; availableCount: number };

async function fetchAssignOptions(): Promise<AssignOption[]> {
  // Bust caches so dropdown counts always match the DB
  const res = await fetch(`/api/task/assign-options?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch assign options");
  return res.json();
}

async function postAssignTasks({
  sourceUserId,
  limit,
}: {
  sourceUserId: number | null;
  limit: number;
}) {
  const res = await fetch("/api/task/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceUserId, limit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to assign tasks");
  return data;
}

async function postTaskUpdate(body: any) {
  return fetch("/api/task/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function fetchUserHistoryApi({ userId, groupId, role }: any) {
  const res = await fetch(
    `/api/user/history?userId=${userId}&groupId=${groupId}&role=${role}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch user history");
  return res.json();
}

async function fetchMoreHistoryApi(skip: number, filter: string) {
  const res = await fetch(`/api/user/history?skip=${skip}&filter=${filter}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch more user history");
  return res.json();
}

const AudioTranscript = ({
  tasks,
  userDetail,
  language,
  userHistory,
}: AudioTranscriptType) => {
  const [languageSelected, setLanguageSelected] = useState("bo");
  const lang = language[languageSelected];
  const [taskList, setTaskList] = useState<any>(tasks);
  // [Reason] transcript + font-size state now live in TranscriptWorkspace so that
  // typing does not re-render this component or its non-editor children.
  const [historyList, setHistoryList] = useState<Task[]>(userHistory || []);
  const [userTaskStats, setUserTaskStats] = useState({
    completedTaskCount: 0,
    totalTaskCount: 0,
    totalTaskPassed: 0,
  });

  const audioRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id: userId, group_id: groupId, role } = userDetail as any;
  const currentTimeRef: any = useRef(null);

  // [Reason] Wrapped in useCallback so this function has a stable identity
  // across renders (deps are only the primitives it actually captures). This
  // lets the useEffect below safely list it as a dependency without causing
  // the effect to re-run on every render.
  const canPickSource = role === "REVIEWER" || role === "FINAL_REVIEWER";

  const [sourceUserId, setSourceUserId] = useState<number | null>(null);
  const [assignLimit, setAssignLimit] = useState(20);
  const [assignOptions, setAssignOptions] = useState<AssignOption[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  // Batch progress for dropdown Load (done / total)
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchDone, setBatchDone] = useState(0);
  const sourceUserIdRef = useRef<number | null>(null);
  const assignLimitRef = useRef(20);
  const batchTotalRef = useRef(0);
  const batchDoneRef = useRef(0);

  useEffect(() => {
    sourceUserIdRef.current = sourceUserId;
  }, [sourceUserId]);
  useEffect(() => {
    assignLimitRef.current = assignLimit;
  }, [assignLimit]);
  useEffect(() => {
    batchTotalRef.current = batchTotal;
  }, [batchTotal]);
  useEffect(() => {
    batchDoneRef.current = batchDone;
  }, [batchDone]);

  const refreshAssignOptions = useCallback(async () => {
    if (!canPickSource) return;
    try {
      const options = await fetchAssignOptions();
      setAssignOptions(options);
    } catch {
      /* ignore */
    }
  }, [canPickSource]);

  useEffect(() => {
    refreshAssignOptions();
  }, [refreshAssignOptions]);

  const setUserProgress = useCallback(async () => {
    try {
      const data = await fetchUserProgress({ userId, role, groupId });
      setUserTaskStats(data);
    } catch (e) {
      console.error(e);
    }
  }, [userId, role, groupId]);

  // [Reason] Transcript initialization moved into TranscriptWorkspace (keyed on
  // task.id + role). This effect keeps only the progress/timer/loading behavior it
  // previously had, unchanged. setUserProgress is now stable (useCallback), so
  // adding it here satisfies exhaustive-deps without changing when the effect runs:
  // it still only re-executes on mount, on taskList changes, or if user identity
  // (userId/role/groupId) changes.
  useEffect(() => {
    setUserProgress();
    currentTimeRef.current = new Date().toISOString();

    if (taskList?.length) {
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [taskList, setUserProgress]);

  const updateTaskAndIndex = async ({
    action,
    transcript,
    task,
    transcript_marks,
  }: any) => {
    try {
      const res = await postTaskUpdate({
        action,
        id: task.id,
        transcript,
        task,
        role,
        currentTime: currentTimeRef.current,
        transcript_marks:
          action === "reject" ? transcript_marks ?? null : null,
      });

      if (res.status === 401) {
        toast.error("Session expired. Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
        return;
      }

      const result = await res.json();
      if (!res.ok || result?.error) {
        toast.error(result?.error || "Failed");
        return;
      }

      toast.success(result?.msg?.success || "Success");

      // [Reason] progress and history are independent of each other and both only
      // depend on the completed update, so run them concurrently to cut post-submit
      // waiting (previously awaited sequentially). Each keeps its own error handling.
      await Promise.all([
        setUserProgress(),
        (async () => {
          try {
            const latestHistory = await fetchUserHistoryApi({
              userId,
              groupId,
              role,
            });
            setHistoryList(latestHistory);
          } catch { }
        })(),
      ]);

      handleTaskListUpdate(action, task.id);
    } catch {
      toast.error("Failed to update task");
    }
  };

  const bumpBatchDone = (action: string) => {
    if (!canPickSource) return;
    if (action !== "submit" && action !== "reject" && action !== "trash") return;
    if (batchTotalRef.current <= 0) return;
    const next = Math.min(batchDoneRef.current + 1, batchTotalRef.current);
    setBatchDone(next);
    if (next >= batchTotalRef.current) {
      toast.success(`Batch complete (${batchTotalRef.current}/${batchTotalRef.current})`);
      setSourceUserId(null);
      sourceUserIdRef.current = null;
      setBatchTotal(0);
      setBatchDone(0);
      batchTotalRef.current = 0;
      batchDoneRef.current = 0;
    }
  };

  const refillTaskQueue = async () => {
    const limit = assignLimitRef.current;
    const selectedSourceId = sourceUserIdRef.current;

    let tasks = await fetchTaskList({
      groupId,
      userId,
      role,
      sourceUserId: selectedSourceId,
      limit,
    });

    // Selected user's pool exhausted → fall back to normal (all users) flow
    if (
      (!Array.isArray(tasks) || tasks.length === 0) &&
      selectedSourceId != null
    ) {
      const fallbackTasks = await fetchTaskList({
        groupId,
        userId,
        role,
        sourceUserId: null,
        limit,
      });
      if (Array.isArray(fallbackTasks) && fallbackTasks.length > 0) {
        setSourceUserId(null);
        sourceUserIdRef.current = null;
        setBatchTotal(0);
        setBatchDone(0);
        toast.success(
          "Selected user's tasks finished — loading from all users"
        );
        tasks = fallbackTasks;
      }
    } else if (
      canPickSource &&
      Array.isArray(tasks) &&
      tasks.length > 0 &&
      selectedSourceId != null &&
      batchDoneRef.current >= batchTotalRef.current &&
      batchTotalRef.current > 0
    ) {
      // Same user still has tasks — start a new batch cycle
      setBatchTotal(tasks.length);
      setBatchDone(0);
    }

    return tasks;
  };

  const handleTaskListUpdate = async (action: any, id: number) => {
    if (action === "submit") {
      currentTimeRef.current = new Date().toISOString();
    }

    bumpBatchDone(action);

    if (taskList.length > 1) {
      setTaskList((prev: any) => prev.filter((t: Task) => t.id !== id));
      // Keep dropdown counts in sync after each completed task
      if (
        action === "submit" ||
        action === "reject" ||
        action === "trash"
      ) {
        refreshAssignOptions();
      }
      return;
    }

    try {
      const moreTask = await refillTaskQueue();
      setTaskList(Array.isArray(moreTask) ? moreTask : []);
      refreshAssignOptions();
    } catch {
      toast.error("Failed to load more tasks");
    }
  };

  const handleLoadTasks = async () => {
    const limit = Math.floor(Number(assignLimit));
    if (!Number.isFinite(limit) || limit < 1) {
      toast.error("Enter a task limit of at least 1");
      return;
    }
    setIsAssigning(true);
    try {
      const result = await postAssignTasks({
        sourceUserId,
        limit,
      });
      if (result?.error && (!result.tasks || result.tasks.length === 0)) {
        toast.error(result.error);
        setTaskList([]);
        setBatchTotal(0);
        setBatchDone(0);
      } else {
        const tasks = Array.isArray(result)
          ? result
          : result.tasks || [];
        setTaskList(tasks);
        if (tasks.length === 0) {
          toast.error("No tasks available");
          setBatchTotal(0);
          setBatchDone(0);
        } else {
          setBatchTotal(tasks.length);
          setBatchDone(0);
          toast.success(`Loaded ${tasks.length} task(s)`);
        }
      }
      await refreshAssignOptions();
    } catch (e: any) {
      toast.error(e?.message || "Failed to load tasks");
    } finally {
      setIsAssigning(false);
    }
  };

  const pickerControls = (
    <>
      <select
        className="select select-sm select-bordered max-w-[12rem] bg-white/80 dark:bg-neutral-900/80"
        value={sourceUserId ?? ""}
        onFocus={() => refreshAssignOptions()}
        onClick={() => refreshAssignOptions()}
        onChange={(e) => {
          const v = e.target.value;
          setSourceUserId(v === "" ? null : Number(v));
        }}
      >
        <option value="">All users</option>
        {assignOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name} ({opt.availableCount})
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        className="input input-sm input-bordered w-20 bg-white/80 dark:bg-neutral-900/80"
        value={assignLimit}
        onChange={(e) => setAssignLimit(Number(e.target.value))}
        title="Task limit"
      />
      <button
        type="button"
        className="btn btn-sm btn-neutral"
        onClick={handleLoadTasks}
        disabled={isAssigning}
      >
        {isAssigning ? "…" : lang.load}
      </button>
    </>
  );

  const taskHeader = (
    <div
      className="
        flex flex-wrap md:flex-nowrap items-center justify-center gap-4 md:gap-8
        rounded-xl
        bg-white/70 dark:bg-neutral-800/60
        backdrop-blur-md
        border border-white/40 dark:border-white/10
        px-6 py-3
        shadow-lg
      "
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-base font-semibold">
          <span className="opacity-60">{lang.transcriber}:</span>
          <span className="font-bold">
            {taskList[0]?.transcriber?.name || "-"}
          </span>
          {(taskList[0]?.transcript_marks as any)?.is_reverted && (
            <span className="text-blue-500 font-bold">(Reverted)</span>
          )}
          {(role === "REVIEWER" || role === "FINAL_REVIEWER") &&
            taskList[0]?.is_resubmission && (
              <span className="text-amber-500 font-bold">(Re-submitted)</span>
            )}
        </div>
        {role === "REVIEWER" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-60">{lang.load_from}</span>
            {pickerControls}
          </div>
        )}
      </div>

      <div className="hidden md:block h-5 w-px bg-neutral-300 dark:bg-neutral-600" />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-base font-semibold">
          <span className="opacity-60">{lang.reviewer}:</span>
          <span className="font-bold">
            {taskList[0]?.reviewer?.name || "-"}
          </span>
          {role === "TRANSCRIBER" && taskList[0]?.reviewer && (
            <span className="text-red-500 font-bold">(Rejected)</span>
          )}
        </div>
        {role === "FINAL_REVIEWER" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-60">{lang.load_from}</span>
            {pickerControls}
          </div>
        )}
      </div>

      {canPickSource && batchTotal > 0 && (
        <>
          <div className="hidden md:block h-5 w-px bg-neutral-300 dark:bg-neutral-600" />
          <div
            className={`text-sm font-semibold tabular-nums ${batchDone >= batchTotal
                ? "text-emerald-500"
                : "text-neutral-700 dark:text-neutral-200"
              }`}
            title="Progress for the last Load batch"
          >
            {batchDone >= batchTotal ? (
              <>Batch complete ({batchDone}/{batchTotal})</>
            ) : (
              <>
                {batchDone}/{batchTotal} done
                <span className="opacity-60 font-normal">
                  {" "}
                  · {Math.max(0, batchTotal - batchDone)} left
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <AppContext.Provider value={{ languageSelected, setLanguageSelected, lang }}>
      <Sidebar
        userDetail={userDetail}
        userTaskStats={userTaskStats}
        taskList={taskList}
        role={role}
        setTaskList={setTaskList}
        userHistory={historyList}
        onHistoryChanged={async () => {
          const latestHistory = await fetchUserHistoryApi({
            userId,
            groupId,
            role,
          });
          setHistoryList(latestHistory);
        }}
        onLoadMoreHistory={async (skip: number, filter: string) => {
          const newItems = await fetchMoreHistoryApi(skip, filter);
          setHistoryList((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const itemsToAdd = newItems.filter((t: any) => !existingIds.has(t.id));
            return [...prev, ...itemsToAdd];
          });
          return newItems.length;
        }}
      >
        {isLoading ? (
          <div className="flex justify-center items-center min-h-[60vh]">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <div className="w-full px-4 py-5">
            <div className="mx-auto max-w-4xl space-y-5">
              {taskHeader}

              {taskList?.length ? (
                <>
                  {/* AUDIO CARD */}
                  <div className="relative rounded-xl bg-white/70 dark:bg-neutral-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg p-2">
                    <div className="rounded-xl bg-white/80 dark:bg-neutral-900/60 p-4">
                      <AudioPlayer tasks={taskList} audioRef={audioRef} />
                    </div>
                  </div>

                  {/* TRANSCRIPT EDITOR + ACTION BUTTONS */}
                  <TranscriptWorkspace
                    task={taskList[0]}
                    tasks={taskList}
                    role={role}
                    updateTaskAndIndex={updateTaskAndIndex}
                    lang={lang}
                  />
                </>
              ) : (
                <div className="flex justify-center items-center min-h-[40vh]">
                  <h1 className="text-xl font-semibold text-neutral-500">
                    {canPickSource
                      ? "No task found. Select a user and Load."
                      : "No task found. Will allocate soon."}
                  </h1>
                </div>
              )}
            </div>
          </div>
        )}
      </Sidebar>
    </AppContext.Provider>
  );
};

export default AudioTranscript;

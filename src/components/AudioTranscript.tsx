"use client";
import React, { useState, useRef, useEffect } from "react";
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

async function fetchTaskList({ userId, groupId, role }: any) {
  const res = await fetch(
    `/api/task/list?userId=${userId}&groupId=${groupId}&role=${role}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
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

  // [Reason] Transcript initialization moved into TranscriptWorkspace (keyed on
  // task.id + role). This effect keeps only the progress/timer/loading behavior it
  // previously had, unchanged.
  useEffect(() => {
    setUserProgress();
    currentTimeRef.current = new Date().toISOString();

    if (taskList?.length) {
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [taskList]);

  const setUserProgress = async () => {
    try {
      const data = await fetchUserProgress({ userId, role, groupId });
      setUserTaskStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskAndIndex = async ({ action, transcript, task }: any) => {
    try {
      const res = await postTaskUpdate({
        action,
        id: task.id,
        transcript,
        task,
        role,
        currentTime: currentTimeRef.current,
      });

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

  const handleTaskListUpdate = async (action: any, id: number) => {
    if (action === "submit") {
      currentTimeRef.current = new Date().toISOString();
    }

    if (taskList.length > 1) {
      setTaskList((prev: any) => prev.filter((t: Task) => t.id !== id));
      return;
    }

    try {
      const moreTask = await fetchTaskList({ groupId, userId, role });
      setTaskList(moreTask);
    } catch {
      toast.error("Failed to load more tasks");
    }
  };

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
      >
        {isLoading ? (
          <div className="flex justify-center items-center min-h-[60vh]">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : taskList?.length ? (
          <div className="w-full px-4 py-5">
            <div className="mx-auto max-w-4xl space-y-5">

              {/* HEADER – ALIGNED */}
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
                <div className="text-base font-semibold">
                  <span className="opacity-60">{lang.transcriber}:</span>{" "}
                  <span className="font-bold">
                    {taskList[0]?.transcriber?.name || "-"}
                  </span>
                </div>

                <div className="hidden md:block h-5 w-px bg-neutral-300 dark:bg-neutral-600" />

                <div className="text-base font-semibold">
                  <span className="opacity-60">{lang.reviewer}:</span>{" "}
                  <span className="font-bold">
                    {taskList[0]?.reviewer?.name || "-"}
                  </span>
                  {role === "TRANSCRIBER" && taskList[0]?.reviewer && (
                    <span className="ml-2 text-red-500 font-bold">(Rejected)</span>
                  )}
                </div>
              </div>

              {/* AUDIO CARD */}
              <div className="relative rounded-xl bg-white/70 dark:bg-neutral-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg p-2">
                <div className="rounded-xl bg-white/80 dark:bg-neutral-900/60 p-4">
                  <AudioPlayer tasks={taskList} audioRef={audioRef} />
                </div>
              </div>

              {/* TRANSCRIPT EDITOR + ACTION BUTTONS */}
              {/* [Reason] Transcript editing UI is isolated in TranscriptWorkspace so
                  keystrokes only re-render this subtree, not the surrounding page. */}
              <TranscriptWorkspace
                task={taskList[0]}
                tasks={taskList}
                role={role}
                updateTaskAndIndex={updateTaskAndIndex}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center min-h-[60vh]">
            <h1 className="text-xl font-semibold text-neutral-500">
              No task found. Will allocate soon.
            </h1>
          </div>
        )}
      </Sidebar>
    </AppContext.Provider>
  );
};

export default AudioTranscript;
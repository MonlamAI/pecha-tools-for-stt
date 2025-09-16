"use client";
import React, { useState, useRef, useEffect } from "react";
import { AudioPlayer } from "./AudioPlayer";
import ActionButtons from "./ActionButtons";
import Sidebar from "@/components/Sidebar";
import toast from "react-hot-toast";
import AppContext from "./AppContext";
import type { Task, User } from "@prisma/client";
import { MAX_HISTORY } from "@/constants/config";

// Types
type AudioTranscriptType = {
  tasks: Task[];
  userDetail: User;
  language: any;
  userHistory: Task[];
};

async function fetchUserProgress({
  userId,
  groupId,
  role,
}: {
  userId: number;
  groupId: number;
  role: string;
}) {
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
}: {
  userId: number;
  groupId: number;
  role: string;
}) {
  const res = await fetch(
    `/api/task/list?userId=${userId}&groupId=${groupId}&role=${role}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

async function postTaskUpdate(body: any) {
  const res = await fetch("/api/task/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
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
  const [transcript, setTranscript] = useState("");
  const [historyList, setHistoryList] = useState<Task[]>(userHistory || []);
  const [userTaskStats, setUserTaskStats] = useState({
    completedTaskCount: 0,
    totalTaskCount: 0,
    totalTaskPassed: 0,
  });
  const audioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id: userId, group_id: groupId, role } = userDetail as any;
  const currentTimeRef: any = useRef(null);

  useEffect(() => {
    setUserProgress();
    currentTimeRef.current = new Date().toISOString();
    if (taskList?.length) {
      setIsLoading(false);
      switch (role) {
        case "TRANSCRIBER":
          taskList[0]?.transcript != null && taskList[0]?.transcript != ""
            ? setTranscript(taskList[0]?.transcript)
            : setTranscript(taskList[0]?.inference_transcript);
          break;
        case "REVIEWER":
          taskList[0].reviewed_transcript != null &&
            taskList[0].reviewed_transcript != ""
            ? setTranscript(taskList[0]?.reviewed_transcript)
            : setTranscript(taskList[0]?.transcript);
          break;
        case "FINAL_REVIEWER":
          setTranscript(taskList[0]?.reviewed_transcript);
          break;
        default:
          break;
      }
    } else {
      setIsLoading(false);
    }
  }, [taskList]);

  const setUserProgress = async () => {
    try {
      const { completedTaskCount, totalTaskCount, totalTaskPassed } =
        await fetchUserProgress({ userId, role, groupId });
      setUserTaskStats({ completedTaskCount, totalTaskCount, totalTaskPassed });
    } catch (error) {
      console.error(error);
    }
  };

  type TaskActionType = "submit" | "reject" | "save" | "trash" | "assign";

  function isHistoryState(role: string, state: string): boolean {
    switch (role) {
      case "TRANSCRIBER":
        return state === "submitted" || state === "trashed";
      case "REVIEWER":
        return state === "accepted" || state === "trashed";
      case "FINAL_REVIEWER":
        return state === "finalised";
      default:
        return false;
    }
  }
  const updateTaskAndIndex = async ({
    action,
    transcript,
    task,
  }: {
    action: TaskActionType;
    transcript: string;
    task: any;
  }) => {
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
        toast.error(result?.error || "Failed to update task");
        return;
      }
      toast.success(result?.msg?.success || "");

      // refresh user progress after updates
      await setUserProgress();

      // update history reactively when the new state belongs to role's history
      const updatedTask: Task | undefined = (result as any)?.updatedTask;
      if (updatedTask && isHistoryState(role as string, (updatedTask as any).state)) {
        setHistoryList((prev) => {
          const next = [updatedTask, ...prev];
          return next.slice(0, MAX_HISTORY);
        });
      }
      handleTaskListUpdate(action, task.id);
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    }
  };

  function getLastTaskIndex() {
    return taskList.length != 0 ? taskList?.length - 1 : 0;
  }
  const handleTaskListUpdate = async (action: TaskActionType, id: number) => {
    // // keep current task on save; only advance on submit/reject/trash
    // if (action === "save") {
    //   return;
    // }
    if (action === "submit") {
      currentTimeRef.current = new Date().toISOString();
    }
    const lastTaskIndex = getLastTaskIndex();

    if (lastTaskIndex !== 0) {
      setTaskList((prev: any) => prev.filter((task: Task) => task.id !== id));
      return;
    }

    try {
      const moreTask = await fetchTaskList({ groupId, userId, role });
      setTaskList(moreTask);
    } catch (error) {
      console.error("Failed to fetch more tasks:", error);
      toast.error("Failed to load more tasks.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{ languageSelected, setLanguageSelected, lang }}
    >
      <Sidebar
        userDetail={userDetail}
        userTaskStats={userTaskStats}
        taskList={taskList}
        role={role}
        setTaskList={setTaskList}
        userHistory={historyList}
      >
        {/* Page content here */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center mt-10 p-5">
            <h1 className="font-bold text-md md:text-3xl">loading...</h1>
          </div>
        ) : taskList?.length ? (
          <>
            <div>
              <p className="mt-4 md:mt-10">
                <strong>{lang.transcriber} : </strong>
                <span>{taskList[0]?.transcriber?.name}</span>
              </p>
              <p className="mt-2">
                <strong>{lang.reviewer} : </strong>
                <span>{taskList[0]?.reviewer?.name}</span>
                {role === "TRANSCRIBER" && taskList[0]?.reviewer?.name ? (
                  <span className="text-red-500">
                    Rejected by {taskList[0]?.reviewer?.name}
                  </span>
                ) : (
                  ""
                )}
              </p>
            </div>
            <div className="border rounded-md shadow-sm shadow-gray-400 w-11/12 md:w-3/4 p-6 md:p-8 mt-4 md:mt-10 bg-base-100">
              <div className="flex flex-col gap-5 justify-center items-center">
                <AudioPlayer tasks={taskList} audioRef={audioRef} />
                <textarea
                  value={transcript || ""}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="rounded-md p-4 border border-slate-400 w-full text-xl bg-base-100 text-base-content"
                  placeholder="Type here..."
                  rows={6}
                  id="transcript"
                />
                <div className="ml-auto text-xs">
                  <span>
                    <strong className="uppercase">{lang.file} : </strong>
                    {taskList[0]?.url.split("/").pop()}
                  </span>
                </div>
              </div>
            </div>
            <ActionButtons
              updateTaskAndIndex={updateTaskAndIndex}
              tasks={taskList}
              transcript={transcript}
              role={role}
            />
          </>
        ) : (
          <div className="flex flex-col justify-center items-center mt-10 p-5">
            <h1 className="font-bold text-lg md:text-3xl">
              No task found, will allocate soon
            </h1>
          </div>
        )}
      </Sidebar>
    </AppContext.Provider>
  );
};

export default AudioTranscript;

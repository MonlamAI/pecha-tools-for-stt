"use client";

import React, { useContext } from "react";
import AppContext from "./AppContext";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { BsCheckLg, BsTrash } from "react-icons/bs";

const Sidebar = ({
  children,
  userDetail,
  userTaskStats,
  taskList,
  role,
  setTaskList,
  userHistory,
  onHistoryChanged,
}) => {
  const { completedTaskCount, totalTaskCount, totalTaskPassed } = userTaskStats;
  const { lang } = useContext(AppContext);

  const handleHistoryClick = async (task) => {
    try {
      const res = await fetch("/api/task/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, role }),
      });
      const newTask = await res.json();
      if (!res.ok || newTask?.error) return;
      setTaskList([newTask, ...taskList]);
      if (onHistoryChanged) {
        try {
          await onHistoryChanged();
        } catch { }
      }
    } catch { }
  };

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-3" type="checkbox" className="drawer-toggle" />

      {/* MAIN CONTENT */}
      <div className="drawer-content flex flex-col items-center">
        <div className="w-full navbar bg-neutral-900 text-white lg:hidden">
          <label htmlFor="my-drawer-3" className="btn btn-square btn-ghost">
            ☰
          </label>
          <div className="flex-1 px-2 font-semibold">Pecha STT Tool</div>
        </div>
        {children}
      </div>

      {/* SIDEBAR */}
      <div className="drawer-side">
        <label htmlFor="my-drawer-3" className="drawer-overlay"></label>

        <aside
          className="
            w-80 h-full
            m-2 rounded-2xl
            bg-white/90 dark:bg-neutral-900/90
            backdrop-blur-xl
            shadow-[0_30px_80px_rgba(0,0,0,0.35)]
            dark:shadow-[0_40px_100px_rgba(0,0,0,0.75)]
            border border-neutral-200 dark:border-neutral-800
            flex flex-col
          "
        >

          {/* PROJECT */}
          <Section title={lang.project}>
            <Row label={lang.user} value={userDetail.name} />
            <Row label={lang.group} value={userDetail.group.name} />
            <Row label={lang.task} value={taskList[0]?.id} />
          </Section>

          {/* TARGET */}
          <Section title={lang.target}>
            <Row
              label={
                role === "TRANSCRIBER"
                  ? lang.submitted
                  : role === "REVIEWER"
                    ? lang.reviewed
                    : lang.final_reviewed
              }
              value={completedTaskCount}
            />

            {(role === "TRANSCRIBER" || role === "REVIEWER") && (
              <Row
                label={
                  role === "TRANSCRIBER"
                    ? lang.reviewed
                    : lang.final_reviewed
                }
                value={totalTaskPassed}
              />
            )}

            <Row label={lang.total_assigned} value={totalTaskCount} />
          </Section>

          {/* LANGUAGE */}
          <Section title={lang.language} horizontal>
            <LanguageToggle />
          </Section>

          {/* THEME */}
          <Section title={lang.theme} horizontal>
            <ThemeToggle />
          </Section>

          {/* HISTORY */}
          <Section title={lang.history} grow>
            <div className="space-y-2">
              {userHistory.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleHistoryClick(task)}
                  className="
                    group cursor-pointer
                    rounded-xl
                    p-3
                    bg-white/60 dark:bg-neutral-800/60
                    hover:bg-white dark:hover:bg-neutral-700
                    border border-neutral-200 dark:border-neutral-700
                    shadow-sm hover:shadow-md
                    transition-all
                  "
                >
                  <p className="text-sm leading-snug line-clamp-2">
                    {role === "TRANSCRIBER"
                      ? task.transcript ?? task.inference_transcript
                      : role === "REVIEWER"
                        ? task.reviewed_transcript ?? task.transcript
                        : task.final_transcript ?? task.reviewed_transcript}
                  </p>

                  <div className="mt-2 flex justify-end text-neutral-500">
                    {(task.state === "submitted" ||
                      task.state === "accepted" ||
                      task.state === "finalised") && (
                        <BsCheckLg className="text-green-600" />
                      )}
                    {task.state === "trashed" && (
                      <BsTrash className="text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
};

/* ---------- SMALL REUSABLE UI PARTS ---------- */

const Section = ({ title, children, horizontal = false, grow = false }) => (
  <section
    className={`
      px-5 py-4
      border-b border-neutral-200 dark:border-neutral-800
      ${grow ? "flex-1 overflow-y-auto" : ""}
    `}
  >
    <h3 className="uppercase text-xs font-bold tracking-wide mb-3 opacity-70">
      {title}
    </h3>

    <div className={horizontal ? "flex items-center gap-4" : "space-y-2"}>
      {children}
    </div>
  </section>
);

const Row = ({ label, value }) => (
  <div className="
    flex justify-between items-center
    text-sm
    py-1.5
    border-b border-neutral-200/70 dark:border-neutral-800/70
    last:border-b-0
  ">
    <span className="font-medium opacity-80">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);

export default Sidebar;

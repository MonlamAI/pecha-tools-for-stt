"use client";
import React, { useContext, useEffect } from "react";
import { BsCheckLg, BsXLg, BsArrowReturnLeft, BsTrash } from "react-icons/bs";
import AppContext from "./AppContext";

const ActionButtons = ({ updateTaskAndIndex, tasks, transcript, role }) => {
  const { lang } = useContext(AppContext);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.altKey && e.keyCode === 65) document.getElementById("submit-button")?.click();
      if (e.altKey && e.keyCode === 88) document.getElementById("reject-button")?.click();
      if (e.altKey && e.keyCode === 83) document.getElementById("save-button")?.click();
      if (e.altKey && e.keyCode === 84) document.getElementById("trash-button")?.click();
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  const btn =
    "flex items-center gap-2 px-6 py-2 rounded-xl backdrop-blur-md " +
    "bg-white/70 dark:bg-neutral-800/60 border border-white/40 dark:border-slate-600/40 " +
    "shadow hover:shadow-md transition";

  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-3 pt-1 pb-8 md:pb-4">
      <button id="submit-button" className={`${btn} text-emerald-600`} onClick={() =>
        updateTaskAndIndex({ action: "submit", transcript, task: tasks[0] })
      }>
        <BsCheckLg /> {lang.submit}
      </button>

      {role !== "TRANSCRIBER" && (
        <button id="reject-button" className={`${btn} text-red-500`} onClick={() =>
          updateTaskAndIndex({ action: "reject", transcript, task: tasks[0] })
        }>
          <BsXLg /> {lang.reject}
        </button>
      )}

      <button id="save-button" className={`${btn} text-yellow-600`} onClick={() =>
        updateTaskAndIndex({ action: "save", transcript, task: tasks[0] })
      }>
        <BsArrowReturnLeft /> {lang.save}
      </button>

      <button id="trash-button" className={`${btn} text-slate-600`} onClick={() =>
        updateTaskAndIndex({ action: "trash", transcript, task: tasks[0] })
      }>
        <BsTrash /> {lang.trash}
      </button>
    </div>
  );
};

export default ActionButtons;

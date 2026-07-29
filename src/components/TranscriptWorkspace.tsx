"use client";
import React, { useState, useEffect } from "react";
import ActionButtons from "./ActionButtons";
import TranscriptPanel, { type TranscriptMarksState } from "./TranscriptPanel";

// [Reason] Owning the font-size list here keeps all transcript-editor UI state
// colocated in this component so typing does not re-render AudioTranscript.
const fontSizes = [
  { label: "A-", class: "text-lg", leading: "leading-[2.1rem]" },
  { label: "A", class: "text-xl", leading: "leading-[2.4rem]" },
  { label: "A+", class: "text-2xl", leading: "leading-[2.8rem]" },
  { label: "A++", class: "text-3xl", leading: "leading-[3.3rem]" },
  { label: "A+++", class: "text-4xl", leading: "leading-[3.9rem]" },
];

type TranscriptWorkspaceType = {
  task: any;
  tasks: any;
  role: string;
  updateTaskAndIndex: (args: any) => void;
};

// [Reason] Isolate transcript state to this subtree so each keystroke only
// re-renders the editor + ActionButtons, not Sidebar/AudioPlayer/header.
const TranscriptWorkspace = ({
  task,
  tasks,
  role,
  updateTaskAndIndex,
}: TranscriptWorkspaceType) => {
  const [transcript, setTranscript] = useState("");
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // default to text-2xl
  const [transcriptMarks, setTranscriptMarks] =
    useState<TranscriptMarksState>(null);
  const canMark = role === "REVIEWER" || role === "FINAL_REVIEWER";
  const markRole =
    role === "REVIEWER" || role === "FINAL_REVIEWER" ? role : null;

  function marksVisibleToRole(
    marks: any,
    currentRole: string,
    currentTranscript: string
  ): TranscriptMarksState {
    if (!marks || !Array.isArray(marks.ranges) || !marks.ranges.length) {
      return null;
    }
    if (marks.text !== currentTranscript) return null;
    if (currentRole === "TRANSCRIBER" && marks.by === "REVIEWER") {
      return marks as TranscriptMarksState;
    }
    if (currentRole === "REVIEWER" && marks.by === "FINAL_REVIEWER") {
      return marks as TranscriptMarksState;
    }
    if (
      (currentRole === "REVIEWER" || currentRole === "FINAL_REVIEWER") &&
      marks.by === currentRole
    ) {
      return marks as TranscriptMarksState;
    }
    return null;
  }

  // [Reason] Preserve existing font-size persistence: load saved index on mount.
  useEffect(() => {
    const savedIndex = localStorage.getItem("pecha_stt_font_size_index");
    if (savedIndex !== null) {
      const parsed = parseInt(savedIndex, 10);
      if (parsed >= 0 && parsed < fontSizes.length) {
        setFontSizeIndex(parsed);
      }
    }
  }, []);

  // [Reason] Reinitialize transcript only when the active task identity or role
  // changes. Keying on task.id (not the taskList reference) prevents resets during
  // Save and during typing, matching the previous behavior exactly. The role-specific
  // fallback logic is preserved verbatim (no getInitialTranscript()). Intentionally
  // NOT depending on the full `task` object: React/parent state can recreate a new
  // task object with the same id (e.g. after Save), and depending on `task` would
  // reset this effect and wipe unsaved edits. task?.id is the correct, minimal
  // dependency for "active task changed".
  useEffect(() => {
    if (!task) return;
    let nextTranscript = "";
    switch (role) {
      case "TRANSCRIBER":
        nextTranscript = task?.transcript || task?.inference_transcript || "";
        break;
      case "REVIEWER":
        nextTranscript = task?.reviewed_transcript || task?.transcript || "";
        break;
      case "FINAL_REVIEWER":
        nextTranscript = task?.reviewed_transcript || "";
        break;
    }
    setTranscript(nextTranscript);
    setTranscriptMarks(
      marksVisibleToRole(task?.transcript_marks, role, nextTranscript)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, role]);

  const handleFontSizeChange = (index: number) => {
    setFontSizeIndex(index);
    localStorage.setItem("pecha_stt_font_size_index", String(index));
  };

  return (
    <>
      {/* TRANSCRIPT CARD */}
      <div className="relative rounded-xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg p-2">

        <TranscriptPanel
          value={transcript || ""}
          onChange={setTranscript}
          marks={transcriptMarks}
          onMarksChange={setTranscriptMarks}
          canMark={canMark}
          markRole={markRole}
          fontClass={fontSizes[fontSizeIndex].class}
          leadingClass={fontSizes[fontSizeIndex].leading}
        />


        {/* FOOTER BAR (FONT SIZE & FILE BADGE) */}
        <div className="mt-1 flex flex-wrap justify-between items-center gap-2 px-2 pb-1">
          {/* Font Size Adjuster */}
          <div className="flex items-center gap-1.5 bg-white/70 dark:bg-neutral-800/60 border border-white/40 dark:border-white/10 px-3 py-1 rounded-full backdrop-blur shadow-sm select-none">
            <span className="text-xs opacity-65 mr-1 font-semibold">Size:</span>
            {fontSizes.map((size, index) => (
              <button
                key={size.label}
                onClick={() => handleFontSizeChange(index)}
                className={`text-xs px-2 py-0.5 rounded-full transition-all cursor-pointer ${fontSizeIndex === index
                  ? "bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950 font-bold"
                  : "hover:bg-neutral-200 dark:hover:bg-neutral-700/60 opacity-80"
                  }`}
              >
                {size.label}
              </button>
            ))}
          </div>

          {/* FILE BADGE */}
          <div
            className="
                inline-flex items-center gap-2
                text-xs px-3 py-1.5
                rounded-full
                bg-white/70 dark:bg-neutral-800/60
                border border-white/40 dark:border-white/10
                backdrop-blur
                shadow-sm
              "
          >
            📄 {task?.url.split("/").pop()}
          </div>
        </div>

      </div>

      {/* ACTION BUTTONS */}
      {/* [Reason] ActionButtons lives inside this subtree and receives the live
          transcript directly, so clicks and keyboard shortcuts always submit the
          latest value with no stale closure or ref indirection. */}
      <ActionButtons
        updateTaskAndIndex={updateTaskAndIndex}
        tasks={tasks}
        transcript={transcript}
        transcriptMarks={transcriptMarks}
        role={role}
      />
    </>
  );
};

export default TranscriptWorkspace;

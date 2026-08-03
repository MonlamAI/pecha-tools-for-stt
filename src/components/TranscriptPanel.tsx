"use client";

import React, { useEffect, useRef, useCallback, useMemo } from "react";

export type MarkRange = { start: number; end: number };

export type TranscriptMarksState = {
  by: "REVIEWER" | "FINAL_REVIEWER";
  text: string;
  ranges: MarkRange[];
} | null;

type TranscriptPanelProps = {
  value: string;
  onChange: (value: string) => void;
  marks: TranscriptMarksState;
  onMarksChange: (marks: TranscriptMarksState) => void;
  canMark: boolean;
  markRole: "REVIEWER" | "FINAL_REVIEWER" | null;
  fontClass: string;
  leadingClass: string;
  lang: any;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mergeRanges(ranges: MarkRange[]): MarkRange[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: MarkRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function buildMarkedHtml(text: string, ranges: MarkRange[]): string {
  if (!text) return "";
  const valid = mergeRanges(
    ranges.filter((r) => r.end > r.start && r.start >= 0 && r.end <= text.length)
  );
  if (!valid.length) return escapeHtml(text);

  let html = "";
  let cursor = 0;
  for (const range of valid) {
    if (cursor < range.start) {
      html += escapeHtml(text.slice(cursor, range.start));
    }
    html += `<span class="underline decoration-red-500 decoration-2 underline-offset-2">${escapeHtml(
      text.slice(range.start, range.end)
    )}</span>`;
    cursor = range.end;
  }
  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }
  return html;
}

function getPlainText(el: HTMLElement) {
  // Prefer innerText so line breaks match what users see.
  return (el.innerText || "").replace(/\u200b/g, "").replace(/\n$/, "");
}

function getSelectionOffsets(container: HTMLElement): MarkRange | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  if (end <= start) return null;
  return { start, end };
}

const TranscriptPanel = ({
  value,
  onChange,
  marks,
  onMarksChange,
  canMark,
  markRole,
  fontClass,
  leadingClass,
  lang,
}: TranscriptPanelProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastExternalRef = useRef<{ value: string; marksKey: string }>({
    value: "",
    marksKey: "",
  });

  const activeRanges = useMemo(
    () => (marks && marks.text === value ? marks.ranges : []),
    [marks, value]
  );
  const marksKey = JSON.stringify(activeRanges);

  // Sync external value/marks into the contenteditable when not focused.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (
      lastExternalRef.current.value === value &&
      lastExternalRef.current.marksKey === marksKey
    ) {
      return;
    }
    // Avoid clobbering caret while the user is typing the same text.
    if (document.activeElement === el && getPlainText(el) === value) {
      // Still refresh HTML when marks changed while focused (underline click).
      if (lastExternalRef.current.marksKey !== marksKey) {
        el.innerHTML = buildMarkedHtml(value || "", activeRanges);
      }
      lastExternalRef.current = { value, marksKey };
      return;
    }
    el.innerHTML = buildMarkedHtml(value || "", activeRanges);
    lastExternalRef.current = { value, marksKey };
  }, [value, marksKey, activeRanges]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = getPlainText(el);
    onChange(text);
    if (marks && marks.text !== text) {
      onMarksChange(null);
    }
  }, [marks, onChange, onMarksChange]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleUnderline = () => {
    const el = editorRef.current;
    if (!el || !canMark || !markRole) return;
    const selection = getSelectionOffsets(el);
    if (!selection) return;

    const text = getPlainText(el);
    const nextRanges = mergeRanges([...(marks?.ranges || []), selection]);
    onChange(text);
    onMarksChange({
      by: markRole,
      text,
      ranges: nextRanges,
    });
    // Re-render marks immediately.
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = buildMarkedHtml(text, nextRanges);
        lastExternalRef.current = {
          value: text,
          marksKey: JSON.stringify(nextRanges),
        };
      }
    });
  };

  const handleClearMarks = () => {
    onMarksChange(null);
    const el = editorRef.current;
    if (el) {
      const text = getPlainText(el);
      el.innerHTML = escapeHtml(text);
      lastExternalRef.current = { value: text, marksKey: "[]" };
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        className={`
          w-full min-h-[8rem] resize-none rounded-xl
          bg-white dark:bg-neutral-800
          border border-neutral-300 dark:border-neutral-700
          p-6 md:p-9
          ${fontClass} ${leadingClass}
          text-neutral-900 dark:text-neutral-100
          focus:outline-none focus:ring-2 focus:ring-neutral-400
          antialiased whitespace-pre-wrap break-words
        `}
      />

      {canMark && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            onClick={handleUnderline}
            className="text-xs px-3 py-1 rounded-full border border-red-400/50 text-red-600 dark:text-red-400 bg-white/70 dark:bg-neutral-800/60 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            {lang.underline_selection}
          </button>
          <button
            type="button"
            onClick={handleClearMarks}
            disabled={!marks?.ranges?.length}
            className="text-xs px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-600 opacity-80 hover:opacity-100 disabled:opacity-40"
          >
            {lang.clear_marks}
          </button>
        </div>
      )}
    </div>
  );
};

export default TranscriptPanel;

"use client";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { BsFillPlayFill, BsFillPauseFill } from "react-icons/bs";
import { ImLoop } from "react-icons/im";
import toast from "react-hot-toast";
import AppContext from "./AppContext";
import {
  getAudioErrorMessage,
  getAudioMimeTypeFromUrl,
  logAudioDiagnostic,
  normalizeAudioUrl,
  safeAudioPlay,
} from "@/utils/audio-utils";

const PLAYBACK_RATE_STORAGE_KEY = "pecha_stt_playback_rate";
const RATES = [0.5, 0.75, 1, 1.25, 1.5];
const PREFETCH_AHEAD = 2;

function readSavedPlaybackRate() {
  if (typeof window === "undefined") return 1;
  try {
    const saved = Number(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY));
    return RATES.includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
}

// [Reason] load() copies defaultPlaybackRate onto playbackRate, so both must be
// set or a new task's audio snaps back to 1x even if the UI still shows 1.5x.
function applyPlaybackRate(audio, rate) {
  if (!audio) return;
  audio.defaultPlaybackRate = rate;
  audio.playbackRate = rate;
}

export const AudioPlayer = ({ tasks, audioRef }) => {
  const { lang } = useContext(AppContext);
  // Starts at 1x so the server-rendered markup matches the first client render;
  // the saved rate is applied right after hydration.
  const [playbackRate, setPlaybackRate] = useState(1);
  const playbackRateRef = useRef(playbackRate);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

  const audioUrl = normalizeAudioUrl(tasks[0]?.url);
  const taskId = tasks[0]?.id;
  const detectedMimeType = getAudioMimeTypeFromUrl(audioUrl);
  const autoPlayAttemptedRef = useRef(false);
  const decodeRetryRef = useRef(0);

  // Hidden audio elements make the same request the player will make, so the
  // next tasks' files are already in the browser cache when the user advances.
  const prefetchedRef = useRef(new Map());
  const upcomingKey = tasks
    .slice(1, 1 + PREFETCH_AHEAD)
    .map((t) => normalizeAudioUrl(t?.url))
    .filter(Boolean)
    .join("\n");

  useEffect(() => {
    const prefetched = prefetchedRef.current;
    const wanted = new Set(upcomingKey ? upcomingKey.split("\n") : []);
    for (const [url, el] of prefetched) {
      if (wanted.has(url)) continue;
      prefetched.delete(url);
      // Don't abort a download the player is about to reuse.
      if (url !== audioUrl) {
        el.removeAttribute("src");
        el.load();
      }
    }
    for (const url of wanted) {
      if (prefetched.has(url)) continue;
      const el = new Audio();
      el.preload = "auto";
      el.src = url;
      prefetched.set(url, el);
    }
  }, [upcomingKey, audioUrl]);

  useEffect(() => {
    const prefetched = prefetchedRef.current;
    return () => {
      for (const el of prefetched.values()) {
        el.removeAttribute("src");
        el.load();
      }
      prefetched.clear();
    };
  }, []);

  const notifyPlaybackFailure = useCallback((message) => {
    setPlaybackError(message);
    toast.error(message);
  }, []);

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      setPlaybackError(null);
      await safeAudioPlay(audio, "play-pause-button", {
        onFailure: notifyPlaybackFailure,
      });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [audioRef, notifyPlaybackFailure]);

  const toggleLoop = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const next = !isLoopEnabled;
    setIsLoopEnabled(next);
    audio.loop = next;

    if (next) {
      setPlaybackError(null);
      await safeAudioPlay(audio, "loop-toggle", {
        onFailure: notifyPlaybackFailure,
      });
    }
  }, [audioRef, isLoopEnabled, notifyPlaybackFailure]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.keyCode === 13 && (e.metaKey || e.ctrlKey || e.altKey)) {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.altKey && e.keyCode === 76) {
        e.preventDefault();
        toggleLoop();
      }
    },
    [handlePlayPause, toggleLoop]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    const saved = readSavedPlaybackRate();
    playbackRateRef.current = saved;
    setPlaybackRate(saved);
  }, []);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  const persistPlaybackRate = useCallback(
    (rate) => {
      playbackRateRef.current = rate;
      setPlaybackRate(rate);
      applyPlaybackRate(audioRef.current, rate);
      try {
        localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate));
      } catch {
        // ignore quota / private-mode failures
      }
    },
    [audioRef]
  );

  useEffect(() => {
    if (audioRef.current) {
      applyPlaybackRate(audioRef.current, playbackRate);
      // [Reason] Re-apply loop preference when a new task/audio element loads.
      audioRef.current.loop = isLoopEnabled;
    }
  }, [audioRef, playbackRate, taskId, isLoopEnabled]);

  useEffect(() => {
    setIsPlaying(false);
    setPlaybackError(null);
    autoPlayAttemptedRef.current = false;
    decodeRetryRef.current = 0;
    // [Reason] key={taskId} remounts the element with a fresh src; extra load() raced autoPlay and caused false decode errors.
    if (audioRef.current) {
      applyPlaybackRate(audioRef.current, playbackRateRef.current);
    }
  }, [taskId, audioUrl, audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    logAudioDiagnostic("init", {
      url: audioUrl,
      taskId,
      detectedMimeType: detectedMimeType ?? "unknown",
      inIframe: window.self !== window.top,
    });

    const onLoadStart = () => {
      applyPlaybackRate(audio, playbackRateRef.current);
      logAudioDiagnostic("loadstart", { url: audioUrl, taskId });
    };

    const onLoadedMetadata = () => {
      applyPlaybackRate(audio, playbackRateRef.current);
      logAudioDiagnostic("loadedmetadata", {
        url: audioUrl,
        taskId,
        duration: audio.duration,
      });
    };

    const onCanPlay = () => {
      applyPlaybackRate(audio, playbackRateRef.current);
      logAudioDiagnostic("canplay", {
        url: audioUrl,
        taskId,
        readyState: audio.readyState,
      });
    };

    const onCanPlayThrough = () => {
      applyPlaybackRate(audio, playbackRateRef.current);
      logAudioDiagnostic("canplaythrough", {
        url: audioUrl,
        taskId,
        readyState: audio.readyState,
      });

      // [Reason] Wait until enough audio is buffered so Chrome does not report spurious MEDIA_ERR_DECODE.
      if (!autoPlayAttemptedRef.current && audioUrl) {
        autoPlayAttemptedRef.current = true;
        void safeAudioPlay(audio, "task-autoplay", {
          showToastOnFailure: false,
          onFailure: notifyPlaybackFailure,
        });
      }
    };

    const onPlay = () => {
      applyPlaybackRate(audio, playbackRateRef.current);
      setIsPlaying(true);
      setPlaybackError(null);
      logAudioDiagnostic("play", { url: audioUrl, taskId });
    };

    const onPause = () => {
      setIsPlaying(false);
      logAudioDiagnostic("pause", { url: audioUrl, taskId });
    };

    const onEnded = () => {
      setIsPlaying(false);
      logAudioDiagnostic("ended", { url: audioUrl, taskId });
    };

    const onError = () => {
      const errorCode = audio.error?.code;

      // [Reason] Chrome sometimes reports MEDIA_ERR_DECODE when load/play was interrupted; one reload usually fixes it.
      if (
        errorCode === MediaError.MEDIA_ERR_DECODE &&
        decodeRetryRef.current < 2 &&
        audioUrl
      ) {
        decodeRetryRef.current += 1;
        autoPlayAttemptedRef.current = false;
        setPlaybackError(null);
        logAudioDiagnostic("decode-retry", {
          url: audioUrl,
          taskId,
          attempt: decodeRetryRef.current,
        });
        applyPlaybackRate(audio, playbackRateRef.current);
        audio.load();
        return;
      }

      const message = getAudioErrorMessage(audio.error);
      setIsPlaying(false);
      setPlaybackError(message);
      logAudioDiagnostic("error", {
        url: audioUrl,
        taskId,
        message,
        code: errorCode,
        networkState: audio.networkState,
        readyState: audio.readyState,
      });
      toast.error(message);
    };

    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    // The element is server-rendered, so it may have finished buffering before
    // these listeners were attached during hydration.
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      onCanPlayThrough();
    }

    return () => {
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("canplaythrough", onCanPlayThrough);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef, audioUrl, taskId, detectedMimeType, notifyPlaybackFailure]);

  // [Reason] Preserve theme-aware control styling from the current branch UI refresh.
  const baseBtn =
    "h-9 w-9 rounded-lg flex items-center justify-center " +
    "bg-slate-100 dark:bg-neutral-700 " +
    "border border-slate-200 dark:border-white/5 " +
    "text-slate-800 dark:text-slate-100 " +
    "hover:bg-slate-200 dark:hover:bg-neutral-600 active:bg-slate-300 dark:active:bg-neutral-800 " +
    "transition-colors duration-300";

  // [Reason] Loop ON inverts colors per theme to match Font Increase active styling.
  const activeLoopBtn =
    "h-9 w-9 rounded-lg flex items-center justify-center " +
    "bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950 " +
    "border border-transparent transition-colors duration-300";

  return (
    <>
      <audio
        ref={audioRef}
        controls
        loop={isLoopEnabled}
        className="w-full rounded-xl opacity-90"
        key={taskId}
        preload="auto"
        playsInline
        src={audioUrl || undefined}
      />
      {playbackError ? (
        <p className="text-sm text-error w-full" role="alert">
          {playbackError}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-center">
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-1.5 px-1 border-r border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={handlePlayPause}
              className={baseBtn}
              disabled={!audioUrl}
            >
              {isPlaying ? <BsFillPauseFill /> : <BsFillPlayFill />}
            </button>

            <button
              type="button"
              onClick={toggleLoop}
              className={isLoopEnabled ? activeLoopBtn : baseBtn}
              disabled={!audioUrl}
            >
              <ImLoop />
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs uppercase font-bold tracking-wider opacity-60 hidden sm:inline">
              {lang.speed}
            </span>

            <div className="flex items-center gap-1">
              {RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => persistPlaybackRate(rate)}
                  // [Reason] Use main's larger speed buttons to match the branch UI refresh sizing.
                  className={`w-10 h-8 text-xs md:text-sm font-medium rounded-md transition-colors ${
                    playbackRate === rate
                      ? "bg-blue-400 text-black shadow-none"
                      : "text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 dark:hover:bg-neutral-600"
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

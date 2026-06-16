"use client";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { BsFillPlayFill, BsFillPauseFill } from "react-icons/bs";
import { ImLoop } from "react-icons/im";
import toast from "react-hot-toast";
import AppContext from "./AppContext";
import {
  getAudioErrorMessage,
  getAudioMimeTypeFromUrl,
  logAudioDiagnostic,
  safeAudioPlay,
} from "@/utils/audio-utils";

export const AudioPlayer = ({ tasks, audioRef }) => {
  const { lang } = useContext(AppContext);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

  const audioUrl = tasks[0]?.url ?? "";
  const taskId = tasks[0]?.id;
  const detectedMimeType = getAudioMimeTypeFromUrl(audioUrl);

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
    }
  }, [audioRef, notifyPlaybackFailure]);

  const toggleLoop = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const newLoopState = !isLoopEnabled;
    setIsLoopEnabled(newLoopState);

    if (newLoopState) {
      setPlaybackError(null);
      await safeAudioPlay(audio, "loop-toggle", {
        onFailure: notifyPlaybackFailure,
      });
    } else {
      audio.pause();
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
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [audioRef, playbackRate, taskId]);

  useEffect(() => {
    setIsPlaying(false);
    setPlaybackError(null);
    setIsLoopEnabled(false);
  }, [taskId, audioUrl]);

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
      logAudioDiagnostic("loadstart", { url: audioUrl, taskId });
    };

    const onLoadedMetadata = () => {
      logAudioDiagnostic("loadedmetadata", {
        url: audioUrl,
        taskId,
        duration: audio.duration,
      });
    };

    const onCanPlay = () => {
      logAudioDiagnostic("canplay", {
        url: audioUrl,
        taskId,
        readyState: audio.readyState,
      });
    };

    const onPlay = () => {
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
      const message = getAudioErrorMessage(audio.error);
      setIsPlaying(false);
      setPlaybackError(message);
      logAudioDiagnostic("error", {
        url: audioUrl,
        taskId,
        message,
        code: audio.error?.code,
        networkState: audio.networkState,
        readyState: audio.readyState,
      });
      toast.error(message);
    };

    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef, audioUrl, taskId, detectedMimeType]);

  const rates = [0.5, 0.75, 1, 1.25, 1.5];

  // [Reason] Preserve theme-aware control styling from the current branch UI refresh.
  const baseBtn =
    "h-9 w-9 rounded-lg flex items-center justify-center " +
    "bg-slate-100 dark:bg-neutral-700 " +
    "border border-slate-200 dark:border-white/5 " +
    "text-slate-800 dark:text-slate-100 " +
    "hover:bg-slate-200 dark:hover:bg-neutral-600 active:bg-slate-300 dark:active:bg-neutral-800 transition-colors";

  const activeBtn =
    "bg-blue-400 text-black border-transparent shadow-none";

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
      >
        {audioUrl ? (
          detectedMimeType ? (
            <source src={audioUrl} type={detectedMimeType} />
          ) : (
            <source src={audioUrl} />
          )
        ) : null}
      </audio>
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
              className={`${baseBtn} ${isLoopEnabled ? activeBtn : ""}`}
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
              {rates.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.playbackRate = rate;
                    }
                    setPlaybackRate(rate);
                  }}
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

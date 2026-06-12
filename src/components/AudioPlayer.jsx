"use client";
import React, { useEffect, useState, useContext } from "react";
import { BsFillPlayFill, BsFillPauseFill } from "react-icons/bs";
import { ImLoop } from "react-icons/im";
import AppContext from "./AppContext";

export const AudioPlayer = ({ tasks, audioRef }) => {
  const { lang } = useContext(AppContext);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);

  const rates = [0.5, 0.75, 1, 1.25, 1.5];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [tasks, playbackRate]);

  const handlePlayPause = () => {
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleLoop = () => {
    const next = !isLoopEnabled;
    setIsLoopEnabled(next);
    audioRef.current.loop = next;
    if (next) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.keyCode === 13 && (e.metaKey || e.ctrlKey || e.altKey)) {
        handlePlayPause();
      }
      if (e.altKey && e.keyCode === 76) {
        toggleLoop();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  const handleAudioEnded = () => setIsPlaying(false);

  // Simple Theme-Aware Buttons
  const baseBtn =
    "h-8 w-8 rounded-lg flex items-center justify-center " +
    "bg-slate-100 dark:bg-neutral-700 " +
    "border border-slate-200 dark:border-white/5 " +
    "text-slate-800 dark:text-slate-100 " +
    "hover:bg-slate-200 dark:hover:bg-neutral-600 active:bg-slate-300 dark:active:bg-neutral-800 transition-colors";

  const activeBtn =
    "bg-blue-400 text-black border-transparent shadow-none";

  return (
    <>
      {/* Native Audio */}
      <audio
        ref={audioRef}
        controls
        loop={isLoopEnabled}
        className="w-full rounded-xl opacity-90"
        key={tasks[0]?.id}
        onEnded={handleAudioEnded}
        autoPlay
      >
        <source src={tasks[0]?.url} type="audio/mp3" />
      </audio>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center">
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-white/5 shadow-sm">
          {/* Play/Pause & Loop */}
          <div className="flex items-center gap-1.5 px-1 border-r border-neutral-300 dark:border-neutral-700">
            <button onClick={handlePlayPause} className={baseBtn}>
              {isPlaying ? <BsFillPauseFill /> : <BsFillPlayFill />}
            </button>

            <button
              onClick={toggleLoop}
              className={`${baseBtn} ${isLoopEnabled ? activeBtn : ""}`}
            >
              <ImLoop />
            </button>
          </div>

          {/* Speed Control */}
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 hidden sm:inline">
              {lang.speed}
            </span>

            <div className="flex items-center gap-1">
              {rates.map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    audioRef.current.playbackRate = rate;
                    setPlaybackRate(rate);
                  }}
                  className={`w-9 h-7 text-[10px] md:text-[11px] font-medium rounded-md transition-colors ${playbackRate === rate
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

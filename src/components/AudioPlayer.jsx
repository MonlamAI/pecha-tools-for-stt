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

  // iOS/macOS Glass Buttons
  const baseBtn =
    "h-9 w-9 rounded-xl flex items-center justify-center " +
    "bg-white/70 dark:bg-slate-800/70 backdrop-blur-md " +
    "border border-white/40 dark:border-white/10 " +
    "text-slate-800 dark:text-slate-100 " +
    "shadow-sm hover:shadow-md transition-all active:scale-95 relative before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none";

  const activeBtn =
    "bg-yellow-300/80 text-black border-yellow-300/60 " +
    "shadow-[0_6px_16px_rgba(250,204,21,0.45)]";

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
      <div className="mt-5 flex flex-col items-center justify-center gap-4">

        <div className="flex items-center gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.18),_0_2px_6px_rgba(0,0,0,0.08)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.55)] p-3 rounded-2xl bg-white/50 dark:bg-neutral-800/50 backdrop-blur-xl">
          <button onClick={handlePlayPause} className={baseBtn}>
            {isPlaying ? <BsFillPauseFill /> : <BsFillPlayFill />}
          </button>

          <button
            onClick={toggleLoop}
            className={`${baseBtn} ${isLoopEnabled ? activeBtn : ""}`}
          >
            <ImLoop />
          </button>

          {/* macOS Segmented Speed Control */}
          <div className="flex items-center gap-2 ml-6">
            <span className="text-sm font-medium tracking-tight text-slate-700 dark:text-slate-300">
              {lang.speed}
            </span>

            <div className="flex rounded-xl bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 p-1">
              {rates.map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    audioRef.current.playbackRate = rate;
                    setPlaybackRate(rate);
                  }}
                  className={`px-3 py-1 text-[11px] rounded-lg transition-all relative before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none ${playbackRate === rate
                    ? "bg-yellow-300/80 text-black shadow"
                    : "text-slate-700 dark:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-700/40"
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

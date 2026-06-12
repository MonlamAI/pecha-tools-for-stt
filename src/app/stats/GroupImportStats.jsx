import React from "react";
import { STATS_CONFIG } from "@/constants/config";

const GroupImportStats = ({ groupStat }) => {
  const importedThreshold = STATS_CONFIG.IMPORT_THRESHOLD;

  const generateColorTheme = (seed) => {
    const themes = [
      { bg: "#2563EB", text: "#EFF6FF" }, // Blue
      { bg: "#4F46E5", text: "#EEF2FF" }, // Indigo
      { bg: "#0F766E", text: "#ECFEFF" }, // Teal
      { bg: "#15803D", text: "#ECFDF5" }, // Emerald
      { bg: "#B45309", text: "#FFFBEB" }, // Amber
      { bg: "#C2410C", text: "#FFF7ED" }, // Orange
    ];

    return themes[Math.abs(seed) % themes.length];
  };

  return (
    <>
      {groupStat?.map((group) => {
        const theme = generateColorTheme(group.department_id);
        const isBelowThreshold =
          group.taskImportedCount < importedThreshold;

        return (
          <div
            key={group.id}
            className={`
              min-h-[52px]
              rounded-2xl
              p-4 md:p-5
              transition-all duration-200
              hover:-translate-y-1
              cursor-pointer
              ${isBelowThreshold
                ? "ring-1 ring-red-300 shadow-red-100"
                : "shadow-sm hover:shadow-md"
              }
            `}
            style={{ backgroundColor: theme.bg }}
          >
            <div
              className="flex items-center justify-between gap-3"
              style={{ color: theme.text }}
            >
              {/* Name + Warning */}
              <p className="text-sm md:text-base font-semibold truncate flex items-center gap-1">
                {group.name}

                {group.taskImportedCount === 0 && (
                  <span
                    title="No tasks imported"
                    className="text-yellow-300 text-base"
                  >
                    ⚠️
                  </span>
                )}
              </p>

              {/* Count */}
              <span
                className="
                  text-sm md:text-base
                  font-semibold
                  px-3 py-1
                  rounded-full
                  bg-white/20 dark:bg-black/40
                  backdrop-blur
                "
              >
                {group.taskImportedCount}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};

export default GroupImportStats;

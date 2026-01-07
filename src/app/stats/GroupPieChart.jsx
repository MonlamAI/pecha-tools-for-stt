"use client";
import React from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const GroupPieChart = ({ group }) => {
  const {
    taskImportedCount,
    taskTranscribingCount,
    taskSubmittedCount,
    taskAcceptedCount,
    taskFinalisedCount,
    taskTrashedCount,
  } = group;

  const values = [
    taskImportedCount,
    taskTranscribingCount,
    taskSubmittedCount,
    taskAcceptedCount,
    taskFinalisedCount,
    taskTrashedCount,
  ];

  const hasData = values.some(v => v > 0);

  const colors = [
    "#9CA3AF", // Imported (Grey)
    "#2563EB", // Transcribing (Blue)
    "#FACC15", // Submitted (Yellow)
    "#22C55E", // Accepted (Green)
    "#A855F7", // Finalised (Purple)
    "#EF4444", // Trashed (Red)
  ];

  const data = {
    labels: [
      "Imported",
      "Transcribing",
      "Submitted",
      "Accepted",
      "Finalised",
      "Trashed",
    ],
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  return (
    <div className="
      w-[360px]
      h-[320px]
      p-4
      rounded-2xl
      shadow-sm
      border
      bg-white
      dark:bg-[#222426]
      dark:border-[#222426]
      flex flex-col
      items-center
      hover:shadow-lg
      transition-all
      duration-200
      mx-auto
    ">
      {/* Title */}
      <h2 className="text-base font-semibold mb-2 dark:text-white capitalize tracking-wide">
        {group.name || "default"}
      </h2>

      {/* No Data */}
      {!hasData && (
        <div className="flex flex-col items-center mt-6 opacity-70">
          <div className="w-20 h-20 rounded-full border-2 border-dashed"></div>
          <p className="mt-3 text-xs dark:text-gray-300">
            No task data yet…
          </p>
        </div>
      )}

      {/* PIE Chart */}
      {hasData && (
        <div className="w-[190px] h-[190px]">
          <Pie
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) =>
                      `${context.label}: ${context.raw.toLocaleString()}`
                  }
                },
              },
            }}
          />
        </div>
      )}

      {/* Apple-style mini legend */}
      {hasData && (
        <div
          className="
            mt-3
            w-full
            rounded-xl
            p-2
            bg-gray-50
            dark:bg-gray-800
            grid grid-cols-3 gap-1
          "
        >
          {data.labels.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colors[i] }}
              />
              <span className="text-[11px] dark:text-gray-200">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupPieChart;

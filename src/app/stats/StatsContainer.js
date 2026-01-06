"use client";
import React, { useState } from "react";
import GroupImportStats from "./GroupImportStats";
import TaskStats from "./TaskStats";

const StatsContainer = ({ groupStatByDept }) => {
    const [view, setView] = useState("import_stats");

    const navItems = [
        { id: "import_stats", label: "Group Stats" },
        { id: "all_departments", label: "All Departments" },
        { id: "per_department", label: "Departments" },
        { id: "per_group", label: "Groups" },
    ];

    const sortedGroupStats =
        view === "import_stats"
            ? [...groupStatByDept].sort(
                (a, b) => a.taskImportedCount - b.taskImportedCount
            )
            : groupStatByDept;

    const HeaderTabs = () => (
        <div className="flex items-center gap-2">
            {navItems.map((item) => {
                const isActive = view === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={`
              px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${isActive
                                ? "bg-teal-600 text-white shadow-md scale-105"
                                : "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            }
            `}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-black transition-colors duration-300">

            {/* Main Content */}
            <div className="flex-1 p-5 md:p-10">
                <div className="max-w-7xl">

                    {/* HEADER BAR */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white">
                            {view === "import_stats"
                                ? "Group Stats on Imported Task"
                                : `${view.replace(/_/g, " ")} Pie Charts`}
                        </h1>

                        {/* Tabs Right Side */}
                        <HeaderTabs />
                    </div>

                    {view === "import_stats" ? (
                        <>
                            {sortedGroupStats.map((groupStat, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4"
                                >
                                    <GroupImportStats groupStat={groupStat} />
                                </div>
                            ))}
                        </>
                    ) : (
                        <TaskStats groupStatByDept={groupStatByDept} viewScope={view} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsContainer;

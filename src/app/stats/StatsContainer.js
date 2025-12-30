"use client";
import React, { useState } from "react";
import GroupImportStats from "./GroupImportStats";
import TaskStats from "./TaskStats";

const StatsContainer = ({ groupStatByDept }) => {
    const [view, setView] = useState("import_stats"); // 'import_stats', 'all_departments', 'per_department', 'per_group'

    const navItems = [
        { id: "import_stats", label: "Group Stats" },
        { id: "all_departments", label: "All Departments" },
        { id: "per_department", label: "Departments" },
        { id: "per_group", label: "Groups" },
    ];

    // Sort zero-count first for import stats
    const sortedGroupStats = view === "import_stats"
        ? [...groupStatByDept].sort((a, b) => a.taskImportedCount - b.taskImportedCount)
        : groupStatByDept;

    const SidebarButton = ({ item }) => {
        const isActive = view === item.id;
        return (
            <button
                onClick={() => setView(item.id)}
                className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300
                    ${isActive
                        ? "bg-teal-100 text-teal-700 shadow-inner scale-105"
                        : "text-teal-900/70 hover:text-teal-700 hover:bg-teal-50 hover:scale-105"
                    }
                `}
            >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm md:text-base whitespace-nowrap">{item.label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
            {/* Sidebar */}
            <div className="w-full md:w-64 p-6 md:fixed md:h-full z-10 flex flex-col gap-8
                            bg-white/70 backdrop-blur-md shadow-lg rounded-r-2xl">
                {/* Logo / Title */}
                <div className="text-teal-700 text-2xl font-extrabold text-center tracking-tight mb-6">
                    PECHA STATS
                </div>

                {/* Navigation */}
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-hide">
                    {navItems.map((item) => (
                        <SidebarButton key={item.id} item={item} />
                    ))}
                </div>

                {/* Optional Footer */}
                <div className="mt-auto text-center text-sm text-teal-900/50">
                    v1.0.0
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 md:ml-64 p-5 md:p-10">
                <div className="max-w-7xl mx-auto">
                    {view === "import_stats" ? (
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-slate-800 mb-8 border-b-4 border-teal-500 pb-2 inline-block">
                                Group Stats on Imported Task
                            </div>
                            {sortedGroupStats.map((groupStat, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4"
                                >
                                    <GroupImportStats groupStat={groupStat} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-slate-800 mb-10 border-b-4 border-teal-500 pb-2 inline-block capitalize">
                                {view.replace(/_/g, " ")} Pie Charts
                            </div>
                            <TaskStats groupStatByDept={groupStatByDept} viewScope={view} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsContainer;

"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import TranscriberReportTable from "../group/TranscriberReportTable";
import ReviewerReportTable from "../group/ReviewerReportTable";
import FinalReviewerTable from "../group/FinalReviewerTable";
import { getCurrentReportCycle, getSiblingReportCycle } from "@/utils/report-date-utils";
import DepartmentTotal from "./DepartmentTotal";

/* =====================================================
   SAFE MERGE HELPER
===================================================== */
const mergeByGroupId = (prev, incoming) => {
  const next = { ...prev };
  Object.entries(incoming || {}).forEach(([groupId, value]) => {
    next[String(groupId)] = value;
  });
  return next;
};

const DepartmentReport = ({ departments }) => {
  const [selectDepartment, setSelectDepartment] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [activeGroupId, setActiveGroupId] = useState("");

  const [deptTotalsLoaded, setDeptTotalsLoaded] = useState(false);
  const [deptTotalsLoading, setDeptTotalsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [usersStatistic, setUsersStatistic] = useState({});
  const [reviewersStatistic, setReviewersStatistic] = useState({});
  const [finalReviewersStatistic, setFinalReviewersStatistic] = useState({});

  /* ================= INIT DATES ================= */
  useEffect(() => {
    if (!dates.from && !dates.to) {
      const cycle = getCurrentReportCycle();
      setDates(cycle);
    }
  }, []);

  /* ================= GROUPS ================= */
  const groups = useMemo(() => {
    if (!selectDepartment) return [];
    return (
      departments.find(
        (d) => d.id === parseInt(selectDepartment)
      )?.groups || []
    );
  }, [selectDepartment, departments]);

  /* Reset when department/date changes */
  useEffect(() => {
    setUsersStatistic({});
    setReviewersStatistic({});
    setFinalReviewersStatistic({});
    setDeptTotalsLoaded(false);

    if (groups.length > 0) {
      setActiveGroupId(String(groups[0].id));
    } else {
      setActiveGroupId("");
    }
  }, [groups, dates.from, dates.to]);

  /* ================= FETCH GROUP ================= */
  useEffect(() => {
    if (!activeGroupId) return;

    const gid = String(activeGroupId);
    const controller = new AbortController();

    if (
      usersStatistic[gid] &&
      reviewersStatistic[gid] &&
      finalReviewersStatistic[gid]
    )
      return;

    async function fetchGroup() {
      setIsLoading(true);
      try {
        const qs = new URLSearchParams({
          groupId: gid,
          ...(dates.from && { from: dates.from }),
          ...(dates.to && { to: dates.to }),
        });

        const res = await fetch(`/api/report/department/group?${qs}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        setUsersStatistic((p) => ({
          ...p,
          [gid]: data.users || [],
        }));
        setReviewersStatistic((p) => ({
          ...p,
          [gid]: data.reviewers || [],
        }));
        setFinalReviewersStatistic((p) => ({
          ...p,
          [gid]: data.finalReviewers || [],
        }));
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Failed to fetch group data:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchGroup();
    return () => controller.abort();
  }, [activeGroupId, dates]);

  /* ================= DEPARTMENT TOTAL ================= */
  const handleLoadDepartmentTotals = async () => {
    if (!selectDepartment || deptTotalsLoaded) return;

    setDeptTotalsLoading(true);

    const qs = new URLSearchParams({
      departmentId: selectDepartment,
      ...(dates.from && { from: dates.from }),
      ...(dates.to && { to: dates.to }),
    });

    const res = await fetch(
      `/api/report/department?${qs}`,
      { cache: "no-store" }
    );

    const data = await res.json();

    setUsersStatistic((p) =>
      mergeByGroupId(p, data.users)
    );
    setReviewersStatistic((p) =>
      mergeByGroupId(p, data.reviewers)
    );
    setFinalReviewersStatistic((p) =>
      mergeByGroupId(p, data.finalReviewers)
    );

    setDeptTotalsLoaded(true);
    setDeptTotalsLoading(false);
  };

  const activeGroup = groups.find(
    (g) => String(g.id) === activeGroupId
  );

  /* ================= RENDER ================= */
  return (
    <div className="w-full px-4 pb-20 font-sans">
      {/* FILTER BAR */}
      <form className="sticky top-0 z-30 bg-base-100 border-b border-base-300 py-1 flex flex-wrap gap-4 justify-between items-end">
        <Select
          title="department_id"
          label="Department"
          options={departments}
          selectedOption={selectDepartment}
          handleOptionChange={(e) =>
            setSelectDepartment(e.target.value)
          }
        />

        {/* DATES WITH LABELED ARROWS */}
        <div className="flex items-end gap-2">
          <DateInput
            label="from"
            selectedDate={dates.from}
            handleDateChange={(e) =>
              setDates((p) => ({ ...p, from: e.target.value }))
            }
            isReport
            labelPrefix={
              <button
                type="button"
                className="btn btn-xs btn-square   h-5 w-5 min-h-0"
                onClick={() => {
                  setDates(getSiblingReportCycle(dates.from, "prev"));
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            }
          />

          <DateInput
            label="to"
            selectedDate={dates.to}
            handleDateChange={(e) =>
              setDates((p) => ({ ...p, to: e.target.value }))
            }
            isReport
            labelSuffix={
              <button
                type="button"
                className="btn btn-xs btn-square  h-5 w-5 min-h-0"
                onClick={() => {
                  setDates(getSiblingReportCycle(dates.from, "next"));
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            }
          />
        </div>
      </form>

      {/* PLACEHOLDER (MATCH GROUP REPORT) */}
      {!selectDepartment && (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-3">
          <h2 className="font-sans text-2xl font-semibold">
            Department Report
          </h2>
          <p className="text-base-content/70">
            Select a department to view statistics.
          </p>
        </div>
      )}

      {selectDepartment && (
        <div className="flex justify-between items-center mt-2 mb-2 gap-4">
          <div className="flex flex-wrap gap-1 bg-base-200 p-1 rounded-md">
            {groups.map((g) => (
              <button
                key={g.id}
                className={`btn btn-xs ${String(g.id) === activeGroupId
                  ? "bg-gray-500"
                  : "btn-ghost"
                  }`}
                onClick={() =>
                  setActiveGroupId(String(g.id))
                }
              >
                {g.name}
              </button>
            ))}
          </div>

          <button
            className="btn bg-gray-500 btn-sm hover:brightness-70"
            onClick={handleLoadDepartmentTotals}
            disabled={deptTotalsLoading}
          >
            {deptTotalsLoading
              ? "Loading..."
              : "Show Department Totals"}
          </button>
        </div>
      )}

      {/* TABLES */}
      {activeGroup && (
        <div className="mt-1 grid grid-cols-1 gap-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <>
              <section className="card bg-base-100 border rounded-2xl p-2">
                <h3 className="font-sans text-lg mb-2 text-center font-bold uppercase">
                  Transcriber Performance
                </h3>
                <TranscriberReportTable
                  usersStatistic={usersStatistic[activeGroup.id] || []}
                  selectGroup={activeGroup.id}
                />
              </section>

              <section className="card bg-base-100 border rounded-2xl p-2">
                <h3 className="font-sans text-lg mb-2 text-center font-bold uppercase">
                  Reviewer Evaluation
                </h3>
                <ReviewerReportTable
                  reviewersStatistic={
                    reviewersStatistic[activeGroup.id] || []
                  }
                />
              </section>

              <section className="card bg-base-100 border rounded-2xl p-2">
                <h3 className="font-sans text-lg mb-2 text-center font-bold uppercase">
                  Final Reviewer Evaluation
                </h3>
                <FinalReviewerTable
                  finalReviewersStatistic={
                    finalReviewersStatistic[activeGroup.id] || []
                  }
                />
              </section>
            </>
          )}
        </div>
      )}

      {deptTotalsLoaded && (
        <section className="mt-8 card bg-base-100 border rounded-2xl p-2">
          <h3 className="font-sans text-xl mb-3 text-center font-bold uppercase">
            Department Total
          </h3>
          <DepartmentTotal usersStatistic={usersStatistic} />
        </section>
      )}
    </div>
  );
};

export default DepartmentReport;

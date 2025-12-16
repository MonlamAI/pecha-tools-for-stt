"use client";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import TranscriberReportTable from "../group/TranscriberReportTable";
import ReviewerReportTable from "../group/ReviewerReportTable";
import DepartmentTotal from "./DepartmentTotal";
import FinalReviewerTable from "../group/FinalReviewerTable";
import DepartmentGroupTotal from "./DepartmentGroupTotal";

const DepartmentReport = ({ departments }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [usersStatistic, setUsersStatistic] = useState({});
  const [reviewersStatistic, setReviewersStatistic] = useState({});
  const [finalReviewersStatistic, setFinalReviewersStatistic] = useState({});
  const [selectDepartment, setSelectDepartment] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [activeGroupId, setActiveGroupId] = useState("");
  const [deptTotalsLoaded, setDeptTotalsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Helpers for datetime-local formatting
  const pad = (n) => String(n).padStart(2, "0");
  const toDatetimeLocal = (d) => {
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0);
  const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59);

  // Initialize default date range to current month on first mount if empty
  useEffect(() => {
    if (!dates.from && !dates.to) {
      const now = new Date();
      const from = startOfMonth(now);
      const to = now; // current time within current month
      setDates({ from: toDatetimeLocal(from), to: toDatetimeLocal(to) });
    }
  }, []);

  const handleDepartmentChange = (event) => {
    setSelectDepartment(event.target.value);
  };

  const handleDateChange = (event) => {
    setDates((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  function getGroupByDepartmentId(departmentId) {
    if (!departmentId) return [];
    return (
      departments.find((department) => department.id === parseInt(departmentId))
        ?.groups || []
    );
  }

  const groups = useMemo(
    () => getGroupByDepartmentId(selectDepartment),
    [selectDepartment, departments]
  );

  // Monthly navigation
  const moveMonth = (delta) => {
    const fromDate = dates.from ? new Date(dates.from) : startOfMonth(new Date());
    const toDate = dates.to ? new Date(dates.to) : new Date();
    const base = new Date(fromDate.getFullYear(), fromDate.getMonth() + delta, 1, 0, 0);
    const newFrom = startOfMonth(base);
    const candidateTo = endOfMonth(base);
    const now = new Date();
    const newTo = candidateTo > now ? now : candidateTo;
    startTransition(() => {
      setDates({ from: toDatetimeLocal(newFrom), to: toDatetimeLocal(newTo) });
    });
  };
  const isCurrentMonth = useMemo(() => {
    if (!dates.to) return true;
    const toDate = new Date(dates.to);
    const now = new Date();
    return toDate.getFullYear() === now.getFullYear() && toDate.getMonth() === now.getMonth();
  }, [dates.to]);

  // Reset caches and default to first group when department or dates change
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

  // Fetch a single group on-demand and cache results
  useEffect(() => {
    async function fetchGroup() {
      if (!activeGroupId) return;
      setIsLoading(true);
      try {
        const qs = new URLSearchParams({
          groupId: String(activeGroupId),
          from: dates.from || "",
          to: dates.to || "",
        }).toString();
        const res = await fetch(`/api/report/department/group?${qs}`, {
          cache: "no-store",
        });
        const data = await res.json();
        setUsersStatistic((prev) => ({
          ...prev,
          [activeGroupId]: data?.users || [],
        }));
        setReviewersStatistic((prev) => ({
          ...prev,
          [activeGroupId]: data?.reviewers || [],
        }));
        setFinalReviewersStatistic((prev) => ({
          ...prev,
          [activeGroupId]: data?.finalReviewers || [],
        }));
      } catch (e) {
        console.error("Error fetching group report:", e);
        setUsersStatistic((prev) => ({ ...prev, [activeGroupId]: [] }));
        setReviewersStatistic((prev) => ({ ...prev, [activeGroupId]: [] }));
        setFinalReviewersStatistic((prev) => ({
          ...prev,
          [activeGroupId]: [],
        }));
      } finally {
        setIsLoading(false);
      }
    }

    const hasUsers = Array.isArray(usersStatistic[activeGroupId]);
    const hasReviewers = Array.isArray(reviewersStatistic[activeGroupId]);
    const hasFinals = Array.isArray(finalReviewersStatistic[activeGroupId]);
    if (!hasUsers || !hasReviewers || !hasFinals) {
      fetchGroup();
    }
  }, [activeGroupId, dates]);

  // Load department totals on demand
  const handleLoadDepartmentTotals = async () => {
    if (!selectDepartment) return;
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        departmentId: String(selectDepartment),
        from: dates.from || "",
        to: dates.to || "",
      }).toString();
      const res = await fetch(`/api/report/department?${qs}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setUsersStatistic(data?.users || {});
      setReviewersStatistic(data?.reviewers || {});
      setFinalReviewersStatistic(data?.finalReviewers || {});
      setDeptTotalsLoaded(true);
    } catch (e) {
      console.error("Error fetching department totals:", e);
      setDeptTotalsLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  const activeGroup = useMemo(
    () => groups.find((g) => String(g.id) === String(activeGroupId)),
    [groups, activeGroupId]
  );

  const isEmpty = (obj) => Object.keys(obj).length === 0;

  return (
    <>
      <form className="sticky top-0 z-20 py-8 bg-base-100 flex flex-col md:flex-row justify-around items-center md:items-end space-y-5 space-x-0 md:space-y-0 md:space-x-10">
        <Select
          title="department_id"
          label="department"
          options={departments}
          selectedOption={selectDepartment}
          handleOptionChange={handleDepartmentChange}
        />
        <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Previous month"
            onClick={() => moveMonth(-1)}
          >
            ←
          </button>
          <DateInput
            label="from"
            selectedDate={dates.from}
            handleDateChange={handleDateChange}
            isReport
          />
          <DateInput
            label="to"
            selectedDate={dates.to}
            handleDateChange={handleDateChange}
            isReport
          />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Next month"
            onClick={() => moveMonth(1)}
            disabled={isCurrentMonth}
          >
            →
          </button>
        </div>
      </form>

      {/* Empty state when no department selected */}
      {!selectDepartment && (
        <div className="w-full flex justify-center items-center py-16">
          <div className="text-base-content/70 text-center">
            <div className="text-xl font-semibold mb-2">Select a department</div>
            <div>Select a department to see the report.</div>
          </div>
        </div>
      )}

      {/* Group switcher */}
      <div className="w-full bg-base-100 sticky top-[84px] z-10">
        <div className="px-4 py-2 overflow-x-auto">
          <div className="flex gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`btn btn-sm ${
                  String(activeGroupId) === String(g.id) ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => startTransition(() => setActiveGroupId(String(g.id)))}
              >
                {g.name}
              </button>
            ))}
            <button
              type="button"
              className={`btn btn-sm ${deptTotalsLoaded ? "btn-secondary" : "btn-outline"}`}
              onClick={() => startTransition(() => { handleLoadDepartmentTotals(); })}
              title="Compute totals across all groups"
              disabled={!selectDepartment}
            >
              {deptTotalsLoaded ? "Refresh Department Totals" : "Show Department Totals"}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full">
        {isLoading || isPending ? (
          <div className="text-center mt-10">
            <span className="loading loading-spinner text-success text-center"></span>
          </div>
        ) : (
          <>
            {activeGroup && (
              <div className="flex flex-col gap-10 justify-center items-center my-8">
                <h1>{activeGroup.name}</h1>
                <TranscriberReportTable
                  usersStatistic={usersStatistic[activeGroup.id]}
                  selectGroup={activeGroup.id}
                />
                <ReviewerReportTable
                  reviewersStatistic={reviewersStatistic[activeGroup.id]}
                />
                <FinalReviewerTable
                  finalReviewersStatistic={finalReviewersStatistic[activeGroup.id]}
                />
                <DepartmentGroupTotal
                  users={usersStatistic[activeGroup.id] || []}
                  reviewers={reviewersStatistic[activeGroup.id] || []}
                  finals={finalReviewersStatistic[activeGroup.id] || []}
                />
              </div>
            )}

            {deptTotalsLoaded && !isEmpty(usersStatistic) && (
              <div className="flex justify-center items-center my-8">
                <DepartmentTotal usersStatistic={usersStatistic} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default DepartmentReport;

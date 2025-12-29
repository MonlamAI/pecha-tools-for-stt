"use client";

import React, { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import TranscriberReportTable from "./TranscriberReportTable";
import ReviewerReportTable from "./ReviewerReportTable";
import FinalReviewerTable from "./FinalReviewerTable";
import { getCurrentReportCycle, getSiblingReportCycle } from "@/utils/report-date-utils";

const GroupReport = ({ groups }) => {
  const [data, setData] = useState({
    users: [],
    reviewers: [],
    finalReviewers: [],
  });

  const [selectGroup, setSelectGroup] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  /* ================= INIT DATES ================= */
  useEffect(() => {
    if (!dates.from && !dates.to) {
      const cycle = getCurrentReportCycle();
      setDates(cycle);
    }
  }, []);

  /* ================= FETCH GROUP DATA ================= */
  useEffect(() => {
    if (!selectGroup) return;

    const controller = new AbortController();

    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          groupId: selectGroup,
          ...(dates.from && { from: dates.from }),
          ...(dates.to && { to: dates.to }),
        });

        const res = await fetch(
          `/api/report/department/group?${params}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        setData({
          users: json.users || [],
          reviewers: json.reviewers || [],
          finalReviewers: json.finalReviewers || [],
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [selectGroup, dates.from, dates.to]);

  /* ================= RENDER ================= */
  return (
    <div className="w-full px-4 pb-20 font-sans">
      {/* FILTER BAR */}
      <form className="sticky top-0 z-30 bg-base-100 border-b border-base-300 py-1 flex flex-wrap gap-4 justify-between items-end">
        <Select
          title="group_id"
          label="Group"
          options={groups}
          selectedOption={selectGroup}
          handleOptionChange={(e) => setSelectGroup(e.target.value)}
        />

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
                className="btn btn-xs btn-square  h-5 w-5 min-h-0"
                onClick={() =>
                  startTransition(() => {
                    setDates(getSiblingReportCycle(dates.from, "prev"));
                  })
                }
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
                onClick={() =>
                  startTransition(() => {
                    setDates(getSiblingReportCycle(dates.from, "next"));
                  })
                }
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            }
          />
        </div>
      </form>

      {/* PLACEHOLDER */}
      {!selectGroup && (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-3">
          <h2 className="font-sans text-2xl font-semibold">
            Group Report
          </h2>
          <p className="text-base-content/70">
            Select a group and date range to view statistics.
          </p>
        </div>
      )}

      {/* REPORT CONTENT */}
      {selectGroup && (
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
                  usersStatistic={data.users}
                  selectGroup={selectGroup}
                />
              </section>

              <section className="card bg-base-100 border rounded-2xl p-2">
                <h3 className="font-sans text-lg mb-2 text-center font-bold uppercase">
                  Reviewer Evaluation
                </h3>
                <ReviewerReportTable
                  reviewersStatistic={data.reviewers}
                />
              </section>

              <section className="card bg-base-100 border rounded-2xl p-2">
                <h3 className="font-sans text-lg mb-2 text-center font-bold uppercase">
                  Final Reviewer Evaluation
                </h3>
                <FinalReviewerTable
                  finalReviewersStatistic={data.finalReviewers}
                />
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupReport;

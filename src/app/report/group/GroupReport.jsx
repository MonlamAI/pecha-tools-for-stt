"use client";

import React, { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import TranscriberReportTable from "./TranscriberReportTable";
import ReviewerReportTable from "./ReviewerReportTable";
import FinalReviewerTable from "./FinalReviewerTable";

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

  /* ================= DATE HELPERS ================= */
  const pad = (n) => String(n).padStart(2, "0");

  const toDatetimeLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const startOfMonth = (d) =>
    new Date(d.getFullYear(), d.getMonth(), 1, 0, 0);

  const endOfMonth = (d) =>
    new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59);

  /* ================= INIT DATES ================= */
  useEffect(() => {
    if (!dates.from && !dates.to) {
      const now = new Date();
      setDates({
        from: toDatetimeLocal(startOfMonth(now)),
        to: toDatetimeLocal(now),
      });
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
    <div className="max-w-7xl mx-auto px-4 pb-20 font-sans">
      {/* FILTER BAR */}
      <form className="sticky top-0 z-30 bg-base-100 border-b border-base-300 py-4 flex flex-wrap gap-6 justify-between items-end">
        <Select
          title="group_id"
          label="group"
          options={groups}
          selectedOption={selectGroup}
          handleOptionChange={(e) => setSelectGroup(e.target.value)}
        />

        <div className="flex items-start gap-3">
          {/* LEFT ARROW */}
          <div className="pt-[48px]">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-outline"
              onClick={() =>
                startTransition(() => {
                  const d = new Date(dates.from);
                  d.setMonth(d.getMonth() - 1);
                  setDates({
                    from: toDatetimeLocal(startOfMonth(d)),
                    to: toDatetimeLocal(endOfMonth(d)),
                  });
                })
              }
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <DateInput
            label="from"
            selectedDate={dates.from}
            handleDateChange={(e) =>
              setDates((p) => ({ ...p, from: e.target.value }))
            }
            isReport
          />

          <DateInput
            label="to"
            selectedDate={dates.to}
            handleDateChange={(e) =>
              setDates((p) => ({ ...p, to: e.target.value }))
            }
            isReport
          />

          {/* RIGHT ARROW */}
          <div className="pt-[48px]">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-outline"
              onClick={() =>
                startTransition(() => {
                  const d = new Date(dates.from);
                  d.setMonth(d.getMonth() + 1);
                  setDates({
                    from: toDatetimeLocal(startOfMonth(d)),
                    to: toDatetimeLocal(endOfMonth(d)),
                  });
                })
              }
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
        <div className="mt-10 grid grid-cols-1 gap-14">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <>
              <section className="card bg-base-100 border rounded-2xl p-5">
                <h3 className="font-sans text-xl mb-4 text-center font-bold uppercase">
                  Transcriber Performance
                </h3>
                <TranscriberReportTable
                  usersStatistic={data.users}
                  selectGroup={selectGroup}
                />
              </section>

              <section className="card bg-base-100 border rounded-2xl p-5">
                <h3 className="font-sans text-xl mb-4 text-center font-bold uppercase">
                  Reviewer Evaluation
                </h3>
                <ReviewerReportTable
                  reviewersStatistic={data.reviewers}
                />
              </section>

              <section className="card bg-base-100 border rounded-2xl p-5">
                <h3 className="font-sans text-xl mb-4 text-center font-bold uppercase">
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

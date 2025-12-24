"use client";
import React, { useEffect, useState } from "react";
import TranscriberReportTable from "./TranscriberReportTable";
import ReviewerReportTable from "./ReviewerReportTable";
import FinalReviewerTable from "./FinalReviewerTable";
import Select from "@/components/Select";
import DateInput from "@/components/DateInput";

const GroupReport = ({ groups }) => {
  const [data, setData] = useState({
    users: [],
    reviewers: [],
    finalReviewers: [],
  });

  const [selectGroup, setSelectGroup] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(false);

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
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        setData(json);
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

  return (
    <>
      <form className="sticky top-0 z-20 py-8 bg-base-100 flex flex-col md:flex-row justify-around items-center md:items-end gap-5">
        <Select
          title="group_id"
          label="group"
          options={groups}
          selectedOption={selectGroup}
          handleOptionChange={(e) => setSelectGroup(e.target.value)}
        />

        <div className="flex gap-4">
          <DateInput
            label="from"
            selectedDate={dates.from}
            handleDateChange={(e) =>
              setDates((p) => ({ ...p, from: e.target.value }))
            }
          />
          <DateInput
            label="to"
            selectedDate={dates.to}
            handleDateChange={(e) =>
              setDates((p) => ({ ...p, to: e.target.value }))
            }
          />
        </div>
      </form>

      <div className="my-10 flex flex-col items-center gap-10">
        {isLoading ? (
          <span className="loading loading-spinner text-success" />
        ) : (
          <>
            <TranscriberReportTable
              usersStatistic={data.users}
              selectGroup={selectGroup}
            />
            <ReviewerReportTable reviewersStatistic={data.reviewers} />
            <FinalReviewerTable
              finalReviewersStatistic={data.finalReviewers}
            />
          </>
        )}
      </div>
    </>
  );
};

export default GroupReport;

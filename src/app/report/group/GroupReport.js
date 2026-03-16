"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  generateUserReportByGroup,
  generateReviewerReportbyGroup,
  generateFinalReviewerReportbyGroup,
} from "@/model/user";
import TranscriberReportTable from "./TranscriberReportTable";
import ReviewerReportTable from "./ReviewerReportTable";
import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import FinalReviewerTable from "./FinalReviewerTable";

const GroupReport = ({ groups }) => {
  const [usersStatistic, setUsersStatistic] = useState([]);
  const [reviewersStatistic, setReviewersStatistic] = useState([]);
  const [finalReviewersStatistic, setFinalReviewersStatistic] = useState([]);
  const [selectGroup, setSelectGroup] = useState("");
  const [draftDates, setDraftDates] = useState({ from: "", to: "" });
  const [appliedDates, setAppliedDates] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(false);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    if (selectGroup) {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;
      setIsLoading(true); // Start loading
      async function fetchData() {
        try {
          // Use Promise.all to wait for all promises to resolve
          const [usersOfGroup, reviewersOfGroup, finalReviewersOfGroup] =
            await Promise.all([
              generateUserReportByGroup(selectGroup, appliedDates),
              generateReviewerReportbyGroup(selectGroup, appliedDates),
              generateFinalReviewerReportbyGroup(selectGroup, appliedDates),
            ]);

          // console.log("GroupReport: useEffect: fetchData: ", {
          //   usersOfGroup,
          //   reviewersOfGroup,
          //   finalReviewersOfGroup,
          // });
          if (latestRequestRef.current !== requestId) return;
          setUsersStatistic(usersOfGroup);
          setReviewersStatistic(reviewersOfGroup);
          setFinalReviewersStatistic(finalReviewersOfGroup);
        } catch (error) {
          console.error("Error fetching group reports:", error);
        } finally {
          if (latestRequestRef.current !== requestId) return;
          setIsLoading(false); // End loading
        }
      }
      fetchData();
    }
  }, [selectGroup, appliedDates]);

  const handleGroupChange = async (event) => {
    setSelectGroup(event.target.value);
  };

  const handleDateChange = async (event) => {
    setDraftDates((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleApplyDateFilter = (event) => {
    event.preventDefault();
    setAppliedDates(draftDates);
  };

  const handleResetDateFilter = () => {
    const emptyDates = { from: "", to: "" };
    setDraftDates(emptyDates);
    setAppliedDates(emptyDates);
  };

  return (
    <>
      <form
        onSubmit={handleApplyDateFilter}
        className="sticky top-0 z-20 py-8 bg-base-100 flex flex-col md:flex-row justify-around items-center md:items-end space-y-5 space-x-0 md:space-y-0 md:space-x-10"
      >
        <Select
          title="group_id"
          label="group"
          options={groups}
          selectedOption={selectGroup}
          handleOptionChange={handleGroupChange}
        />
        <div className="flex flex-col md:flex-row gap-2 md:gap-6">
          <DateInput
            label="from"
            selectedDate={draftDates.from}
            handleDateChange={handleDateChange}
          />
          <DateInput
            label="to"
            selectedDate={draftDates.to}
            handleDateChange={handleDateChange}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm">
            Apply
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetDateFilter}
          >
            Reset
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-10 justify-center items-center my-10">
        {isLoading ? (
          <div className="text-center mt-10">
            <span className="loading loading-spinner text-success text-center"></span>
          </div>
        ) : (
          <>
            <TranscriberReportTable
              usersStatistic={usersStatistic}
              selectGroup={selectGroup}
            />
            <ReviewerReportTable reviewersStatistic={reviewersStatistic} />
            <FinalReviewerTable
              finalReviewersStatistic={finalReviewersStatistic}
            />
          </>
        )}
      </div>
    </>
  );
};

export default GroupReport;

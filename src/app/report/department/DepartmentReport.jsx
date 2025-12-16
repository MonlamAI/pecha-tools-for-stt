"use client";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  Suspense,
} from "react";

import {
  generateUserReportByGroup,
  generateReviewerReportbyGroup,
  generateFinalReviewerReportbyGroup,
} from "@/model/user";

import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import DepartmentTotal from "./DepartmentTotal";

const TranscriberReportTable = React.lazy(() =>
  import("../group/TranscriberReportTable")
);
const ReviewerReportTable = React.lazy(() =>
  import("../group/ReviewerReportTable")
);
const FinalReviewerTable = React.lazy(() =>
  import("../group/FinalReviewerTable")
);

const TableSkeleton = () => (
  <div className="w-full space-y-4 animate-pulse">
    <div className="h-6 bg-gray-300 rounded"></div>
    <div className="h-40 bg-gray-200 rounded"></div>
  </div>
);

const DepartmentReport = ({ departments }) => {
  const [isLoading, setIsLoading] = useState(false);

  const [usersStatistic, setUsersStatistic] = useState({});
  const [reviewersStatistic, setReviewersStatistic] = useState({});
  const [finalReviewersStatistic, setFinalReviewersStatistic] = useState({});

  const [selectDepartment, setSelectDepartment] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const cacheRef = useRef({});

  const handleDepartmentChange = useCallback((event) => {
    setSelectDepartment(event.target.value);
    setSelectedGroupId(null);
    setHasSearched(false);
  }, []);

  const handleDateChange = useCallback((event) => {
    setDates((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
    setHasSearched(false);
  }, []);

  const selectedGroups = useMemo(() => {
    if (!selectDepartment) return [];
    const dept = departments.find(
      (d) => d.id === parseInt(selectDepartment)
    );
    return dept?.groups || [];
  }, [selectDepartment, departments]);

  // AUTO-SELECT FIRST GROUP
  useEffect(() => {
    if (selectedGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(selectedGroups[0].id);
    }
  }, [selectedGroups, selectedGroupId]);

  // 🚀 FETCH REPORTS (FIXED)
  useEffect(() => {
    if (!hasSearched) return;
    if (!selectDepartment || !selectedGroupId) return;

    const fetchReports = async () => {
      const cacheKey = `${selectedGroupId}_${dates.from}_${dates.to}`;

      if (cacheRef.current[cacheKey]) {
        const cached = cacheRef.current[cacheKey];
        setUsersStatistic(cached.users);
        setReviewersStatistic(cached.reviewers);
        setFinalReviewersStatistic(cached.finalReviewers);
        return;
      }

      try {
        setIsLoading(true);

        // ✅ ONLY SELECTED GROUP API CALLS
        const [userReport, reviewerReport, finalReviewerReport] =
          await Promise.all([
            generateUserReportByGroup(selectedGroupId, dates),
            generateReviewerReportbyGroup(selectedGroupId, dates),
            generateFinalReviewerReportbyGroup(selectedGroupId, dates),
          ]);

        const newUsers = { [selectedGroupId]: userReport };
        const newReviewers = { [selectedGroupId]: reviewerReport };
        const newFinalReviewers = { [selectedGroupId]: finalReviewerReport };

        setUsersStatistic(newUsers);
        setReviewersStatistic(newReviewers);
        setFinalReviewersStatistic(newFinalReviewers);

        cacheRef.current[cacheKey] = {
          users: newUsers,
          reviewers: newReviewers,
          finalReviewers: newFinalReviewers,
        };
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [hasSearched, selectDepartment, selectedGroupId, dates]);

  const isEmpty = (obj) => Object.keys(obj).length === 0;

  return (
    <>
      {/* Filters */}
      <form
        className="sticky top-0 z-20 py-8 bg-base-100 flex flex-col md:flex-row justify-around items-center
       md:items-end space-y-5 md:space-y-0 md:space-x-10"
      >
        <Select
          title="department_id"
          label="department"
          options={departments}
          selectedOption={selectDepartment}
          handleOptionChange={handleDepartmentChange}
        />

        <div className="flex flex-col md:flex-row gap-2 md:gap-6">
          <DateInput
            label="from"
            selectedDate={dates.from}
            handleDateChange={handleDateChange}
          />
          <DateInput
            label="to"
            selectedDate={dates.to}
            handleDateChange={handleDateChange}
          />
        </div>

        <button
          type="button"
          onClick={() => setHasSearched(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition"
        >
          Search
        </button>
      </form>

      {/* Group Buttons */}
      {selectedGroups.length > 0 && hasSearched && (
        <div className="flex flex-wrap justify-center gap-4 my-6">
          {selectedGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`px-6 py-3 rounded-xl shadow-md font-semibold transition-all border ${
                selectedGroupId === group.id
                  ? "bg-blue-600 text-white border-blue-700 shadow-lg"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:shadow-lg"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      {/* Reports */}
      <div className="w-full">
        {!hasSearched && (
          <p className="text-center text-gray-500 mt-8">
            Select Department + Date Range and click <b>Search</b>
          </p>
        )}

        {isLoading ? (
          <div className="text-center mt-10">
            <span className="loading loading-spinner text-success"></span>
          </div>
        ) : (
          <>
            {hasSearched &&
              selectedGroupId &&
              selectedGroups
                .filter((g) => g.id === selectedGroupId)
                .map((group) => (
                  <div
                    key={group.id}
                    className="flex flex-col gap-10 justify-center items-center my-8 w-full"
                  >
                    <Suspense fallback={<TableSkeleton />}>
                      <TranscriberReportTable
                        usersStatistic={usersStatistic[group.id]}
                        selectGroup={group.id}
                      />
                      <ReviewerReportTable
                        reviewersStatistic={reviewersStatistic[group.id]}
                      />
                      <FinalReviewerTable
                        finalReviewersStatistic={
                          finalReviewersStatistic[group.id]
                        }
                      />
                    </Suspense>
                  </div>
                ))}

            {hasSearched && !isEmpty(usersStatistic) && (
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

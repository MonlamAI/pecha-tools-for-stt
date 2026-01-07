"use client";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import UserReportTable from "./UserReportTable";
import Select from "@/components/Select";
import DateInput from "@/components/DateInput";
import { useRouter, usePathname } from "next/navigation";
import useDebounce from "@/components/hooks/useDebounceState";
import { getCurrentReportCycle, getSiblingReportCycle } from "@/utils/report-date-utils";

const UserReport = ({ searchParams, id, users }) => {
  const [userTaskRecord, setUserTaskRecord] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [selectedOption, setSelectedOption] = useState(id ? id : "");
  const [secretAccess, setSecretAccess] = useState(false);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [transcript, setTranscript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const debouncedSearchTerm = useDebounce(transcript, 1000);
  const page = searchParams["page"] ?? "1";
  const per_page = searchParams["per_page"] ?? "10";
  const isReport = pathname.includes("report");
  let allUserSpecificTasks = useRef([]);

  // Number of items per page
  const limit = typeof per_page === "string" ? parseInt(per_page) : 10;
  // Number of items to skip
  const skip =
    typeof page === "string"
      ? parseInt(page) > 0
        ? (parseInt(page) - 1) * limit
        : 0
      : 0;
  const end = skip + limit;

  /* ================= INIT DATES ================= */
  useEffect(() => {
    if (!dates.from && !dates.to) {
      setDates(getCurrentReportCycle());
    }
  }, []);

  useEffect(() => {
    setIsLoading(true); // Start loading
    async function getUserReportByGroup() {
      try {
        const qs = new URLSearchParams({
          id: String(selectedOption || ""),
          limit: String(limit),
          skip: String(skip),
          from: dates.from || "",
          to: dates.to || "",
        });
        const [tasksRes, countRes] = await Promise.all([
          fetch(`/api/report/user/tasks?${qs.toString()}`, { cache: "no-store" }),
          fetch(
            `/api/report/user/count?${new URLSearchParams({
              id: String(selectedOption || ""),
              from: dates.from || "",
              to: dates.to || "",
            }).toString()}`,
            { cache: "no-store" }
          ),
        ]);
        const [tasks, totalUserSpecificTasks] = await Promise.all([
          tasksRes.json(),
          countRes.json(),
        ]);
        allUserSpecificTasks.current = Array.isArray(tasks) ? tasks : [];
        setUserTaskRecord(allUserSpecificTasks.current); // Update state with the fetched data
        setTotalTasks(totalUserSpecificTasks); // Update state with the total count
      } catch (error) {
        console.error("Failed to fetch user report by group:", error);
        // Optionally, handle the error state in your UI as well
      } finally {
        setIsLoading(false); // End loading regardless of try/catch outcome
      }
    }
    getUserReportByGroup();
  }, [selectedOption, skip, limit, dates]);

  const handleOptionChange = async (event) => {
    setSelectedOption(event.target.value);
    router.push(`/report/user/${event.target.value}`);
  };

  const handleDateChange = async (event) => {
    setDates((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const totalTasksCount = totalTasks;
  const pageCount = Math.ceil(totalTasksCount / limit);

  const handlePassword = (event) => {
    if (event.target.value === process.env.NEXT_PUBLIC_PASSWORD) {
      setSecretAccess(true);
    } else {
      setSecretAccess(false);
    }
  };

  const handleFilter = (event) => {
    setTranscript(event.target.value);
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      const filter = debouncedSearchTerm;
      const filteredTasks = allUserSpecificTasks.current.filter((task) => {
        const transcript = task.transcript;
        return transcript.includes(filter);
      });
      setUserTaskRecord(filteredTasks);
    } else {
      // Return original list of tasks
      setUserTaskRecord(allUserSpecificTasks.current);
    }
  }, [debouncedSearchTerm]);

  return (
    <div className="h-full">
      <form className="sticky top-0 z-20 py-1 px-4 bg-white dark:bg-[#222426] flex flex-wrap gap-4 justify-between items-end border-b border-base-300">
        <div className="flex flex-wrap items-end gap-2 md:gap-4">
          <Select
            title="user_id"
            label="User"
            options={users}
            selectedOption={selectedOption}
            handleOptionChange={handleOptionChange}
            isReport={isReport}
          />
          <input
            name="filter"
            placeholder="Search transcript"
            type="text"
            className="input input-bordered input-sm max-w-xs"
            value={transcript}
            onChange={handleFilter}
          />
          <input
            name="password"
            placeholder="Password"
            type="password"
            className="input input-bordered input-sm max-w-[120px]"
            onChange={handlePassword}
          />
        </div>

        <div className="flex items-end gap-2">
          <DateInput
            label="from"
            selectedDate={dates.from}
            handleDateChange={handleDateChange}
            isReport={isReport}
            labelPrefix={
              <button
                type="button"
                className="btn btn-xs btn-square h-5 w-5 min-h-0"
                onClick={() =>
                  startTransition(() => {
                    setDates((prev) => {
                      const newDates = getSiblingReportCycle(prev.from, "prev");
                      return { ...prev, ...newDates };
                    });
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
            handleDateChange={handleDateChange}
            isReport={isReport}
            labelSuffix={
              <button
                type="button"
                className="btn btn-xs btn-square h-5 w-5 min-h-0"
                onClick={() =>
                  startTransition(() => {
                    setDates((prev) => {
                      const newDates = getSiblingReportCycle(prev.from, "next");
                      return { ...prev, ...newDates };
                    });
                  })
                }
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            }
          />
        </div>
      </form>
      <div className="w-full px-4 my-4">
        {isLoading ? (
          <div className="text-center mt-10">
            <span className="loading loading-spinner text-success text-center"></span>
          </div>
        ) : (
          <>
            <section className="card bg-base-100 dark:bg-[#222426] border dark:border-none rounded-2xl p-2 w-full">
              <UserReportTable
                userTaskRecord={userTaskRecord}
                secretAccess={secretAccess}
                setUserTaskRecord={setUserTaskRecord}
              />
            </section>
            <div className="mt-4 flex justify-center">
              <PaginationControls
                page={page}
                per_page={per_page}
                hasNextPage={end < totalTasksCount}
                hasPrevPage={skip > 0}
                pageCount={pageCount}
                isReport={isReport}
                setTranscript={setTranscript}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserReport;

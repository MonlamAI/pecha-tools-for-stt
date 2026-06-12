import { revertTaskState } from "@/model/action";
import React, { useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { FaLongArrowAltUp, FaLongArrowAltDown } from "react-icons/fa";

const UserReportTable = ({
  userTaskRecord,
  secretAccess,
  setUserTaskRecord,
}) => {
  function formattedDate(date) {
    if (!date) return "";

    // If already a string (production case)
    if (typeof date === "string") {
      return new Date(date).toISOString();
    }

    // If Date object (localhost case)
    if (date instanceof Date) {
      return date.toISOString();
    }

    // Fallback safety
    return "";
  }

  const [disabledButtons, setDisabledButtons] = useState({});
  const countRef = useRef(0);

  const handleRevertState = async (id, state) => {
    //console.log(id, state);
    if (disabledButtons[id]) return; // If the button is already disabled, do nothing

    try {
      const updatedTask = await revertTaskState(id, state);

      if (updatedTask?.error) {
        toast.error(updatedTask.error);
      } else {
        toast.success(updatedTask.success);

        // Disable the button after success
        setDisabledButtons({ ...disabledButtons, [id]: true });
      }
    } catch (error) {
      throw new Error(error);
    }
  };

  const sortAudioDutation = () => {
    // sort audio duration in ascending order on one click and descending order on next click
    countRef.current++;
    if (countRef.current % 2 === 0) {
      setUserTaskRecord(
        [...userTaskRecord].sort((a, b) => b.audio_duration - a.audio_duration)
      );
    } else {
      setUserTaskRecord(
        [...userTaskRecord].sort((a, b) => a.audio_duration - b.audio_duration)
      );
    }
  };

  return (
    <>
      <div className="relative overflow-x-auto">
        <table className="table w-full font-sans tabular-nums text-sm">
          {/* head */}
          <thead className="text-gray-700 dark:text-gray-200 bg-base-200 dark:bg-[#222426] uppercase">
            <tr>
              <th className="pr-80">Transcript</th>
              <th>Audio</th>
              <th>State</th>
              {secretAccess && <th>Revert State</th>}
              <th>Transcriber</th>
              <th>Reviewer</th>
              <th>Final Reviewer</th>
              <th>Submitted at</th>
              <th>Reviewed at</th>
              <th>File name</th>
              <th
                onClick={sortAudioDutation}
                className="flex flex-row items-center gap-1 cursor-pointer"
              >
                Audio duration
                {countRef.current % 2 === 0 ? (
                  <FaLongArrowAltDown />
                ) : (
                  <FaLongArrowAltUp />
                )}
              </th>
              <th>Transcript syllable count</th>
              <th>Reviewed syllable count</th>
            </tr>
          </thead>
          <tbody>
            {userTaskRecord.map((task) => (
              <tr key={task.id}>
                <td>
                  <div className="grid gap-2 mb-2">
                    <strong>Submitted:</strong>
                    {task.transcript}
                  </div>
                  {task.reviewed_transcript !== null && (
                    <div className="grid gap-2 mb-2">
                      <strong>Reviewed:</strong>
                      {task.reviewed_transcript}
                    </div>
                  )}
                  {task.final_transcript !== null && (
                    <div className="grid gap-2 mb-2">
                      <strong>Final:</strong>
                      {task.final_transcript}
                    </div>
                  )}
                </td>
                <td>
                  <audio controls controlsList="nodownload">
                    <source src={task.url} type="audio/mpeg" />
                  </audio>
                </td>
                <td>{task.state}</td>
                {secretAccess && (
                  <td>
                    <button
                      className="btn"
                      disabled={disabledButtons[task.id]}
                      onClick={() => handleRevertState(task.id, task.state)}
                    >
                      ❌
                    </button>
                  </td>
                )}
                <td>
                  {task.transcriber?.name || ""}
                </td>
                <td>{task.reviewer?.name || ""}</td>
                <td>{task.final_reviewer?.name || ""}</td>
                <td>
                  {formattedDate(task.submitted_at)}

                </td>
                <td>
                  {formattedDate(task.reviewed_at)}

                </td>
                <td>{task.file_name}</td>
                <td>{task.audio_duration}</td>
                <td>{task.transcriptSyllableCount}</td>
                <td>{task.reviewedSyllableCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default UserReportTable;

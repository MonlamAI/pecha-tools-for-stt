import React from "react";
import { calculatePercent } from "@/lib/calculatePercent";

const DepartmentTotal = ({ usersStatistic }) => {
  // Safely merge all users from all groups
  const allUsersStatistic = [];

  for (let key in usersStatistic) {
    if (Array.isArray(usersStatistic[key])) {
      allUsersStatistic.push(...usersStatistic[key]);
    }
  }

  // If there are no users, show fallback
  if (!allUsersStatistic.length) {
    return (
      <p className="text-center text-gray-500 mt-4">
        No data available for selected groups/dates.
      </p>
    );
  }

  // Safely calculate totals with default 0 if any field is missing
  const totalSubmitted = allUsersStatistic.reduce(
    (a, b) => a + (b.noSubmitted || 0),
    0
  );
  const totalReviewed = allUsersStatistic.reduce(
    (a, b) => a + (b.noReviewed || 0),
    0
  );
  const totalSubmittedMin = allUsersStatistic.reduce(
    (a, b) => a + (b.submittedInMin || 0),
    0
  );
  const totalReviewedMin = allUsersStatistic.reduce(
    (a, b) => a + (b.reviewedInMin || 0),
    0
  );
  const totalCorrected = allUsersStatistic.reduce(
    (a, b) => a + (b.noTranscriptCorrected || 0),
    0
  );
  const totalCer = allUsersStatistic.reduce((a, b) => a + (b.cer || 0), 0);
  const totalChars = allUsersStatistic.reduce(
    (a, b) => a + (b.characterCount || 0),
    0
  );
  const totalSyllables = allUsersStatistic.reduce(
    (a, b) => a + (b.syllableCount || 0),
    0
  );

  return (
    <div className="overflow-x-auto shadow-md sm:rounded-lg w-11/12 md:w-4/5 max-h-[80vh]">
      <table className="table text-black dark:text-white">
        <thead className="text-sm uppercase text-black dark:text-slate-50">
          <tr>
            <th>Department Total</th>
            <th>Task <br /> Submitted</th>
            <th>Task <br /> Reviewed</th>
            <th>Reviewed %</th>
            <th>Submitted Min.</th>
            <th>Reviewed Min.</th>
            <th>Reviewed min %</th>
            <th>Task Corrected %</th>
            <th>Character Error %</th>
            <th>Reviewed <br /> Syllable count</th>
          </tr>
        </thead>
        <tbody className="text-black dark:text-white">
          <tr>
            <td><b>Total</b></td>
            <td><b>{totalSubmitted}</b></td>
            <td><b>{totalReviewed}</b></td>
            <td><b>{calculatePercent(totalReviewed, totalSubmitted)}</b></td>
            <td><b>{totalSubmittedMin.toFixed(2)}</b></td>
            <td><b>{totalReviewedMin.toFixed(2)}</b></td>
            <td><b>{calculatePercent(totalReviewedMin, totalSubmittedMin)}</b></td>
            <td><b>{calculatePercent(totalCorrected, totalReviewed)}</b></td>
            <td><b>{calculatePercent(totalCer, totalChars)}</b></td>
            <td><b>{totalSyllables}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default DepartmentTotal;

import Link from "next/link";
import React from "react";

const FinalReviewerTable = ({ finalReviewersStatistic }) => {
  return (
    <div className="overflow-x-auto shadow-md sm:rounded-lg w-11/12 md:w-4/5 max-h-[80vh]">
      <table className="table  ">
        {/* head */}
        <thead className="text-sm uppercase text-black dark:text-slate-50">
          <tr>
            <th>Final Reviewer Name</th>
            <th>Task Finalised</th>
            <th>Finalised minutes</th>
          </tr>
        </thead>
        <tbody className="text-black dark:text-slate-50">
          {finalReviewersStatistic?.map((finalReviewer) => (
            <tr key={finalReviewer.id}>
              <td>
                <Link href={`/report/user/${finalReviewer.id}`}
                className="text-black dark:text-slate-50"
                >
                  {finalReviewer.name}
                </Link>
              </td>
              <td>{finalReviewer.noFinalised}</td>
              <td>{finalReviewer.finalisedInMin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinalReviewerTable;

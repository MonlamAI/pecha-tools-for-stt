import Link from "next/link";
import React from "react";

const FinalReviewerTable = ({ finalReviewersStatistic = [] }) => {
  return (
    <div className="relative overflow-x-auto">
      <table className="table w-full min-w-[700px] font-sans tabular-nums text-sm">
        <thead className="uppercase bg-base-200 text-base-content/80">
          <tr>
            <th className="sticky left-0 z-10 bg-base-200">
              Final Reviewer Name
            </th>
            <th>Task Finalised</th>
            <th>Finalised Minutes</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {finalReviewersStatistic.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center py-6">
                No final reviewer data
              </td>
            </tr>
          )}

          {finalReviewersStatistic.map((fr) => (
            <tr key={fr.id}>
              <td className="sticky left-0 bg-base-100 font-medium">
                <Link
                  href={`/report/user/${fr.id}`}
                  className="hover:underline"
                >
                  {fr.name ||
                    fr.finalReviewerName ||
                    "Unknown"}
                </Link>
              </td>
              <td>{fr.noFinalised ?? 0}</td>
              <td>{fr.finalisedInMin?.toFixed?.(2) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinalReviewerTable;

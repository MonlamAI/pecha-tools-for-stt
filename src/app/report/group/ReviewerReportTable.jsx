import { calculatePercent } from "@/lib/calculatePercent";
import Link from "next/link";
import React from "react";

const ReviewerReportTable = ({ reviewersStatistic }) => {
  const glideGreentoRed = (num1, num2) => {
    // Calculate the percentage
    const percentage = calculatePercent(num1, num2);
    // if else to return the color based on the percentage
    if (percentage > 90) {
      return "bg-[#ff0000] text-black"; // Red
    } else if (percentage > 80) {
      return "bg-[#ff4500] text-black"; // Red-orange
    } else if (percentage > 70) {
      return "bg-[#ff7700] text-black"; // Dark orange
    } else if (percentage > 60) {
      return "bg-[#ffa700] text-black"; // Orange
    } else if (percentage > 50) {
      return "bg-[#ffc700] text-black"; // Orange-yellow
    } else if (percentage > 40) {
      return "bg-[#fff400] text-black"; // Yellow
    } else if (percentage > 30) {
      return "bg-[#cfff00] text-black"; // Light lime green
    } else if (percentage > 20) {
      return "bg-[#a3ff00] text-black"; // Lime green
    } else if (percentage > 10) {
      return "bg-[#4edc00] text-black"; // Light green
    } else {
      return "bg-[#2cba00] text-black"; // Dark green
    }
  };

  const glideRedtoGreen = (num1, num2) => {
    // Calculate the percentage
    const percentage = calculatePercent(num1, num2);
    // if else to return the color based on the percentage
    if (percentage > 90) {
      return "bg-[#2cba00] text-black"; // Dark green
    } else if (percentage > 80) {
      return "bg-[#4edc00] text-black"; // Light green
    } else if (percentage > 70) {
      return "bg-[#a3ff00] text-black"; // Lime green
    } else if (percentage > 60) {
      return "bg-[#cfff00] text-black"; // Light lime green
    } else if (percentage > 50) {
      return "bg-[#fff400] text-black"; // Yellow
    } else if (percentage > 40) {
      return "bg-[#ffc700] text-black"; // Orange-yellow
    } else if (percentage > 30) {
      return "bg-[#ffa700] text-black"; // Orange
    } else if (percentage > 20) {
      return "bg-[#ff7700] text-black"; // Dark orange
    } else if (percentage > 10) {
      return "bg-[#ff4500] text-black"; // Red-orange
    } else {
      return "bg-[#ff0000] text-black"; // Red
    }
  };

  return (
    <div className="relative overflow-x-auto">
      <table className="table w-full min-w-[1100px] font-sans tabular-nums text-sm">
        <thead className="uppercase bg-base-200">
          <tr>
            <th className="sticky left-0 bg-base-200 z-10">
              Reviewer Name
            </th>
            <th>Task Reviewed</th>
            <th>Task Accepted</th>
            <th>Task Finalised</th>
            <th>Reviewed minutes</th>
            <th>Finalised %</th>
            <th>Task Corrected %</th>
            <th>Character Error %</th>
          </tr>
        </thead>
        <tbody classsName="tabular-nums">
          {reviewersStatistic.map((r) => (
            <tr key={r.id}>
              <td className="sticky left-0 bg-base-100 font-medium">
                <Link
                  href={`/report/user/${r.id}`}
                  className="hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td>{r.noReviewed}</td>
              <td>{r.noAccepted}</td>
              <td>{r.noFinalised}</td>
              <td>{r.reviewedInMin}</td>
              <td
                className={`${glideRedtoGreen(
                  r.noFinalised,
                  r.noReviewed
                )}`}
              >
                {calculatePercent(r.noFinalised, r.noReviewed)}
              </td>
              <td
                className={`${glideGreentoRed(
                  r.noReviewedTranscriptCorrected,
                  r.noFinalised
                )}`}
              >
                {calculatePercent(
                  r.noReviewedTranscriptCorrected,
                  r.noFinalised
                )}
              </td>
              <td
                className={`${glideGreentoRed(
                  r.totalCer,
                  r.characterCount
                )}`}
              >
                {calculatePercent(r.totalCer, r.characterCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReviewerReportTable;

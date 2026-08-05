/**
 * Calculate transcriber pay from group pay category (AB / MV / TT / GR).
 * Prefer Group.pay_category — do not hardcode group IDs.
 */
export const calculatePay = (
  payCategory,
  reviewedInMin,
  trashedInMin,
  syllableCount,
  reviewedCount, // Task Reviewed (from table)
  transcriberSyllableCount
) => {
  const category = String(payCategory || "MV").toUpperCase();

  if (category === "AB") {
    return ((reviewedInMin + trashedInMin) * 5 + reviewedCount * 2).toFixed(2);
  }
  if (category === "TT" || category === "UK") {
    return ((reviewedInMin + trashedInMin) * 5 + syllableCount * 0.3).toFixed(2);
  }
  if (category === "GR") {
    return ((transcriberSyllableCount || 0) * 0.5).toFixed(2);
  }
  // MV and any unknown category
  return ((reviewedInMin + trashedInMin) * 5 + syllableCount * 0.35).toFixed(2);
};

/**
 * Calculate Reviewer pay based on their team's total earnings.
 */
export const calculateReviewerPay = (teamEarnings) => {
  let ap = 0;
  if (teamEarnings > 60000) {
    ap = 15000;
  } else if (teamEarnings >= 40000) {
    ap = 10000;
  } else if (teamEarnings >= 20000) {
    ap = 5000;
  }
  const totalSalary = (teamEarnings * 0.25) + ap;
  return {
    teamEarnings: Number(teamEarnings).toFixed(2),
    ap: Number(ap).toFixed(2),
    totalSalary: Number(totalSalary).toFixed(2),
  };
};

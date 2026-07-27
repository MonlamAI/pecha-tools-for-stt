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
  if (category === "TT") {
    return ((reviewedInMin + trashedInMin) * 5 + syllableCount * 0.3).toFixed(2);
  }
  if (category === "GR") {
    return ((transcriberSyllableCount || 0) * 0.5).toFixed(2);
  }
  // MV and any unknown category
  return ((reviewedInMin + trashedInMin) * 5 + syllableCount * 0.35).toFixed(2);
};

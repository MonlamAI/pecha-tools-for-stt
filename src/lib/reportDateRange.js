const REPORT_TIMEZONE_OFFSET_MINUTES = 330; // Asia/Kolkata (IST)

const parseDateTimeLocalAsFixedZone = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return null;

  const [, y, m, d, h, min, s = "0"] = match;
  const utcMs =
    Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      Number(s)
    ) -
    REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
};

export const getReportDateRange = (fromDate, toDate) => {
  if (!fromDate || !toDate) return null;
  const gte = parseDateTimeLocalAsFixedZone(fromDate);
  const lte = parseDateTimeLocalAsFixedZone(toDate);

  if (!gte || !lte) return null;
  return { gte, lte };
};

export const buildDateFilter = (fieldName, fromDate, toDate) => {
  const range = getReportDateRange(fromDate, toDate);
  return range ? { [fieldName]: range } : {};
};

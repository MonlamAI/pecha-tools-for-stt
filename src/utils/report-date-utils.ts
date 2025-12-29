import {
    REPORT_CYCLE_DAY,
    REPORT_CYCLE_START_TIME,
    REPORT_CYCLE_END_TIME,
} from "@/constants/config";

const pad = (n: number) => String(n).padStart(2, "0");

export const toDatetimeLocal = (d: Date) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Returns the current reporting cycle range based on the given date (default current).
 *
 * If today is >= 25th:
 *   From: This month 25th 12:01
 *   To: Next month 25th 12:00
 *
 * If today is < 25th:
 *   From: Last month 25th 12:01
 *   To: This month 25th 12:00
 */
export const getCurrentReportCycle = (now = new Date()) => {
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let fromDate: Date;
    let toDate: Date;

    const startHour = parseInt(REPORT_CYCLE_START_TIME.split(":")[0]);
    const startMinute = parseInt(REPORT_CYCLE_START_TIME.split(":")[1]);
    const endHour = parseInt(REPORT_CYCLE_END_TIME.split(":")[0]);
    const endMinute = parseInt(REPORT_CYCLE_END_TIME.split(":")[1]);

    if (currentDay >= REPORT_CYCLE_DAY) {
        // Current cycle starts on the 25th of this month
        fromDate = new Date(currentYear, currentMonth, REPORT_CYCLE_DAY, startHour, startMinute);
        // Ends on the 25th of next month
        toDate = new Date(currentYear, currentMonth + 1, REPORT_CYCLE_DAY, endHour, endMinute);
    } else {
        // Current cycle started on the 25th of last month
        fromDate = new Date(currentYear, currentMonth - 1, REPORT_CYCLE_DAY, startHour, startMinute);
        // Ends on the 25th of this month
        toDate = new Date(currentYear, currentMonth, REPORT_CYCLE_DAY, endHour, endMinute);
    }

    return {
        from: toDatetimeLocal(fromDate),
        to: toDatetimeLocal(toDate),
    };
};

/**
 * Shifts a cycle by one month in the given direction.
 */
export const getSiblingReportCycle = (currentFromStr: string, direction: "prev" | "next") => {
    const [datePart, timePart] = currentFromStr.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    // Reconstruct the start date of the current cycle
    const currentFrom = new Date(year, month - 1, day, hour, minute);

    const startHour = parseInt(REPORT_CYCLE_START_TIME.split(":")[0]);
    const startMinute = parseInt(REPORT_CYCLE_START_TIME.split(":")[1]);
    const endHour = parseInt(REPORT_CYCLE_END_TIME.split(":")[0]);
    const endMinute = parseInt(REPORT_CYCLE_END_TIME.split(":")[1]);

    let nextFrom: Date;
    if (direction === "next") {
        nextFrom = new Date(currentFrom.getFullYear(), currentFrom.getMonth() + 1, REPORT_CYCLE_DAY, startHour, startMinute);
    } else {
        nextFrom = new Date(currentFrom.getFullYear(), currentFrom.getMonth() - 1, REPORT_CYCLE_DAY, startHour, startMinute);
    }

    const nextTo = new Date(nextFrom.getFullYear(), nextFrom.getMonth() + 1, REPORT_CYCLE_DAY, endHour, endMinute);

    return {
        from: toDatetimeLocal(nextFrom),
        to: toDatetimeLocal(nextTo),
    };
};

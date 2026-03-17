import React from "react";

const DateInput = ({ label, selectedDate, handleDateChange, isReport }) => {
  const maxLocalDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  return (
    <div
      className={`${
        isReport
          ? "flex flex-row gap-2 md:form-control md:gap-0"
          : "form-control"
      }`}
    >
      <label className="label w-[20%]" htmlFor={label}>
        <span className="label-text text-base font-semibold capitalize">
          {label}
        </span>
      </label>
      <input
        name={label}
        type="datetime-local"
        className="input input-bordered max-w-xs"
        value={selectedDate}
        onChange={handleDateChange}
        max={maxLocalDateTime}
        min={"2021-01-01T00:00"}
      />
    </div>
  );
};

export default DateInput;

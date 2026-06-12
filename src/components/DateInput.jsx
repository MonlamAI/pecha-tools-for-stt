import React from "react";

const DateInput = ({
  label,
  selectedDate,
  handleDateChange,
  isReport,
  labelPrefix,
  labelSuffix,
}) => {
  const maxLocalDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  return (
    <div
      className={`${isReport
        ? "flex flex-row gap-2 md:form-control md:gap-0"
        : "form-control"
        }`}
    >
      <label className="label w-fit pr-2 gap-2 flex items-bottom leading-none" htmlFor={label}>
        {labelPrefix && <span className="flex items-center">{labelPrefix}</span>}
        <span className="label-text text-sm font-semibold capitalize dark:text-gray-200 uppercase">
          {label}
        </span>
        {labelSuffix && <span className="flex items-center">{labelSuffix}</span>}
      </label>
      <input
        name={label}
        type="datetime-local"
        className="input input-bordered input-sm rounded-md max-w-xs dark:bg-black dark:border-neutral-800"
        value={selectedDate}
        onChange={handleDateChange}
        max={maxLocalDateTime}
        min={"2021-01-01T00:00"}
      />
    </div>
  );
};

export default DateInput;

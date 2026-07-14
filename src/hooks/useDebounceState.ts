import React from "react";

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
    // [Reason] Include `delay` so changing the debounce interval reschedules the timeout instead of using a stale delay.
  }, [value, delay]);

  return debouncedValue;
};
export default useDebounce;

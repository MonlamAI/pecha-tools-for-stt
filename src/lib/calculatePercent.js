export const calculatePercent = (num1, num2) => {
  const n1 = Number(num1) || 0;
  const n2 = Number(num2) || 0;

  if (n2 === 0) return 0;

  return Number(((n1 / n2) * 100).toFixed(2));
};

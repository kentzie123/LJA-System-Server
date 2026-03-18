export const calculateHours = (start, end) => {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const diffMs = endDate - startDate;

  if (diffMs <= 0) return 0;

  const hours = diffMs / (1000 * 60 * 60);

  return hours.toFixed(2);
};
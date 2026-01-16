export const calculateHours = (start, end) => {
  if (!start || !end) return 0;

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const startDate = new Date(0, 0, 0, startH, startM);
  const endDate = new Date(0, 0, 0, endH, endM);

  let diff = (endDate - startDate) / 1000 / 60 / 60; // in hours

  // Handle overnight logic if needed (e.g., 10 PM to 2 AM)
  if (diff < 0) diff += 24;

  return diff.toFixed(2);
};

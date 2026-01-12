export const calculateDays = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  // validation
  if (isNaN(startDate) || isNaN(endDate)) {
    throw new Error("Invalid date format");
  }

  const timeDiff = endDate.getTime() - startDate.getTime();

  // Add 1 because Jan 1 to Jan 1 is 1 day, not 0
  const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

  return days;
};

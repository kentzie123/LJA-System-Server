import pool from "../config/db.js";

// 1. Fetch Calendar Events (Range Support + Dynamic Birthdays)
export const getCalendarEvents = async (month, year) => {
  const query = `
    -- Manual Events with Range Logic
    SELECT 
      id, 
      title, 
      description, 
      start_date::TEXT, 
      end_date::TEXT, 
      event_type, 
      is_payroll_holiday,
      NULL::INT as user_id
    FROM public.company_events
    WHERE 
      -- Check if the event range overlaps with the requested month/year
      (start_date <= (make_date($2::INT, $1::INT, 1) + interval '1 month' - interval '1 day')::DATE)
      AND 
      (end_date >= make_date($2::INT, $1::INT, 1))

    UNION ALL

    -- Birthdays (Birthdays are always single-day events)
    SELECT 
      u.id as id,
      CONCAT(u.fullname, '''s Birthday') as title,
      CONCAT('This day is ', u.fullname, '''s birthday! Be sure to wish them a happy birthday.') as description,
      TO_CHAR(
        make_date($2::INT, EXTRACT(MONTH FROM u.date_of_birth)::INT, EXTRACT(DAY FROM u.date_of_birth)::INT), 
        'YYYY-MM-DD'
      ) as start_date,
      TO_CHAR(
        make_date($2::INT, EXTRACT(MONTH FROM u.date_of_birth)::INT, EXTRACT(DAY FROM u.date_of_birth)::INT), 
        'YYYY-MM-DD'
      ) as end_date,
      'Birthday' as event_type,
      false as is_payroll_holiday,
      u.id as user_id
    FROM public.users u
    WHERE u.date_of_birth IS NOT NULL 
    AND EXTRACT(MONTH FROM u.date_of_birth) = $1
    AND u."isActive" = true
    
    ORDER BY start_date ASC;
  `;

  const result = await pool.query(query, [month, year]);
  return result.rows;
};

// 2. Create New Event (Supports Range)
export const createEvent = async (eventData) => {
  const { title, description, start_date, end_date, event_type, is_payroll_holiday, created_by } = eventData;

  const result = await pool.query(
    `INSERT INTO public.company_events 
    (title, description, start_date, end_date, event_type, is_payroll_holiday, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [title, description, start_date, end_date, event_type, is_payroll_holiday, created_by]
  );

  return result.rows[0];
};

// 3. Update Existing Event (Supports Range)
export const updateEvent = async (id, eventData) => {
  const { title, description, start_date, end_date, event_type, is_payroll_holiday } = eventData;

  const result = await pool.query(
    `UPDATE public.company_events 
     SET title = $1, description = $2, start_date = $3, end_date = $4, event_type = $5, is_payroll_holiday = $6
     WHERE id = $7
     RETURNING *`,
    [title, description, start_date, end_date, event_type, is_payroll_holiday, id]
  );

  if (result.rows.length === 0) throw new Error("Event not found");
  return result.rows[0];
};

// 4. Delete Event
export const deleteEvent = async (id) => {
  const result = await pool.query(
    "DELETE FROM public.company_events WHERE id = $1 RETURNING *",
    [id]
  );

  if (result.rows.length === 0) throw new Error("Event not found");
  return result.rows[0];
};
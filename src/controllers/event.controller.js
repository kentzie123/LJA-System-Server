import * as EventService from "../services/event.service.js";

// 1. Fetch Calendar Data (Now supports overlap logic via Service)
export const fetchCalendarEvents = async (req, res) => {
  try {
    const { month, year } = req.query;

    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    if (isNaN(targetMonth) || isNaN(targetYear)) {
      return res.status(400).json({ error: "Invalid month or year parameters." });
    }

    const events = await EventService.getCalendarEvents(targetMonth, targetYear);
    res.status(200).json(events);
  } catch (error) {
    console.error("Fetch Events Error:", error);
    res.status(500).json({ error: "Failed to fetch calendar events." });
  }
};

// 2. Create a New Event (Range Support)
export const createEvent = async (req, res) => {
  try {
    // Note: ensure your verifyToken middleware sets req.user.id or req.user.userId
    const userId = req.user.id || req.user.userId; 
    
    // Expecting start_date and end_date in req.body
    const eventData = { ...req.body, created_by: userId };

    const newEvent = await EventService.createEvent(eventData);
    res.status(201).json({
      message: "Event created successfully",
      event: newEvent,
    });
  } catch (error) {
    console.error("Create Event Error:", error);
    
    // Handle unique constraint if you have one on (title, start_date)
    if (error.code === '23505') {
      return res.status(400).json({ error: "A similar event already exists for these dates." });
    }
    
    res.status(500).json({ error: "Failed to create event." });
  }
};

// 3. Update an Event
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    // req.body now contains start_date and end_date
    const updatedEvent = await EventService.updateEvent(id, req.body);
    
    res.status(200).json({
      message: "Event updated successfully",
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Update Event Error:", error);
    if (error.message === "Event not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update event." });
  }
};

// 4. Delete an Event
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await EventService.deleteEvent(id);
    
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Delete Event Error:", error);
    if (error.message === "Event not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete event." });
  }
};
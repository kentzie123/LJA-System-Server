import express from "express";
import { 
  fetchCalendarEvents, 
  createEvent, 
  updateEvent, 
  deleteEvent 
} from "../controllers/event.controller.js";

// Using verifyToken and checkPermission from your centralized auth middleware
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Fetch Calendar Data
// UPDATED: Now strictly checks for perm_event_view
router.get("/", 
  verifyToken, 
  checkPermission("perm_event_view"), 
  fetchCalendarEvents
);

// 2. Create New Event
// UPDATED: Now uses perm_event_manage
router.post("/", 
  verifyToken, 
  checkPermission("perm_event_manage"), 
  createEvent
);

// 3. Update Event
// UPDATED: Now uses perm_event_manage
router.put("/:id", 
  verifyToken, 
  checkPermission("perm_event_manage"), 
  updateEvent
);

// 4. Delete Event
// UPDATED: Now uses perm_event_manage
router.delete("/:id", 
  verifyToken, 
  checkPermission("perm_event_manage"), 
  deleteEvent
);

export default router;
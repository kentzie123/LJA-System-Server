// server.js
import dotenv from "dotenv";

import server from "./src/app.js";

import "./src/config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`✅ HRIS Server listening on http://localhost:${PORT}`);
});

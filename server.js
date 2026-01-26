import dotenv from "dotenv";
import server from "./src/app.js";
import "./src/config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ HRIS Server listening on port ${PORT}`);
  console.log(`📡 Access locally via http://localhost:${PORT}`);
});

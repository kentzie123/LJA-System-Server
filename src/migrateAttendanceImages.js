import pool from "./config/db.js"
import { saveBase64Image } from "./utils/fileUtils.js";

const runAttendanceMigration = async () => {
  console.log("🚀 Starting Attendance Image Migration to WebP...");

  try {
    // 1. Find all attendance logs that have a Base64 string in either photo column
    // --- FIXED: Changed table name from attendance_logs to attendance ---
    const { rows: records } = await pool.query(`
      SELECT id, user_id, photo_in, photo_out 
      FROM attendance 
      WHERE photo_in LIKE 'data:image%' 
         OR photo_out LIKE 'data:image%'
    `);

    if (records.length === 0) {
      console.log("✅ No Base64 attendance photos found. You are completely clean!");
      process.exit(0);
    }

    console.log(`Found ${records.length} attendance records with Base64 images. Converting to WebP...`);

    // 2. Loop through each record
    for (const record of records) {
      let newPhotoIn = record.photo_in;
      let newPhotoOut = record.photo_out;
      let needsUpdate = false;

      // 3a. Process Photo In
      if (record.photo_in && record.photo_in.startsWith('data:image')) {
        console.log(`⏳ Converting Time-In photo for Record ${record.id}...`);
        newPhotoIn = await saveBase64Image(record.photo_in, record.user_id, 'in');
        needsUpdate = true;
      }

      // 3b. Process Photo Out
      if (record.photo_out && record.photo_out.startsWith('data:image')) {
        console.log(`⏳ Converting Time-Out photo for Record ${record.id}...`);
        newPhotoOut = await saveBase64Image(record.photo_out, record.user_id, 'out');
        needsUpdate = true;
      }

      // 4. Update the database only if one or both photos were successfully converted
      // --- FIXED: Changed table name from attendance_logs to attendance ---
      if (needsUpdate) {
        await pool.query(`
          UPDATE attendance 
          SET photo_in = $1, photo_out = $2 
          WHERE id = $3
        `, [newPhotoIn, newPhotoOut, record.id]);
        
        console.log(`✅ Record ${record.id} updated successfully!`);
      }
    }

    console.log("🎉 Attendance migration complete! Your database is now 100% Base64 free.");
    process.exit(0);

  } catch (error) {
    console.error("🚨 Migration failed:", error);
    process.exit(1);
  }
};

runAttendanceMigration();
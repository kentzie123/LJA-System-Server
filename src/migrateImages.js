import pool from "./config/db.js"
import { saveBase64Image } from "./utils/fileUtils.js";

const runMigration = async () => {
  console.log("🚀 Starting Image Migration to WebP...");

  try {
    // 1. Find all users who still have a Base64 string as their profile picture
    const { rows: users } = await pool.query(`
      SELECT id, fullname, profile_picture 
      FROM users 
      WHERE profile_picture LIKE 'data:image%'
    `);

    if (users.length === 0) {
      console.log("✅ No Base64 images found. Your database is already clean!");
      process.exit(0);
    }

    console.log(`Found ${users.length} users with Base64 images. Converting to WebP...`);

    // 2. Loop through each user
    for (const user of users) {
      console.log(`⏳ Converting ${user.fullname}...`);
      
      // Pass the giant base64 string into our new Sharp-powered utility
      const newWebpUrl = await saveBase64Image(user.profile_picture, user.id, 'profile');

      if (newWebpUrl) {
        // 3. Update the database with the tiny new URL
        await pool.query(`
          UPDATE users 
          SET profile_picture = $1 
          WHERE id = $2
        `, [newWebpUrl, user.id]);
        
        console.log(`✅ ${user.fullname} converted successfully! -> ${newWebpUrl}`);
      } else {
        console.log(`❌ Failed to convert ${user.fullname}.`);
      }
    }

    console.log("🎉 Migration complete! Your database is fully optimized.");
    process.exit(0);

  } catch (error) {
    console.error("🚨 Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
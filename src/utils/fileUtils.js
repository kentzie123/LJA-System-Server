import fs from 'fs/promises';
import path from 'path';

export const saveBase64Image = async (base64String, userId, type) => {
  // 1. If there's no photo, or it's already a saved URL, return it as-is
  if (!base64String) return null;
  if (!base64String.startsWith('data:image')) return base64String;

  try {
    // 2. Extract the raw image data from the Base64 string
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    // Get the file extension (usually jpeg or png)
    let extension = matches[1].split('/')[1];
    if (extension === 'jpeg') extension = 'jpg';
    
    // Convert the text back into a binary image file
    const imageData = Buffer.from(matches[2], 'base64');
    
    // 3. Create a unique filename: e.g., "user_5_in_1709456789.jpg"
    const filename = `user_${userId}_${type}_${Date.now()}.${extension}`;
    
    // 4. Define the folder path dynamically based on the type
    const folderName = type === 'profile' ? 'profiles' : 'attendance';
    const uploadDir = path.join(process.cwd(), 'uploads', folderName);

    // 5. Ensure the folder exists, if not, create it automatically
    await fs.mkdir(uploadDir, { recursive: true });

    // 6. Save the file to your hard drive
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, imageData);

    // 7. Return the URL path to save in PostgreSQL
    return `/uploads/attendance/${filename}`;
    
  } catch (error) {
    console.error("Error saving image to disk:", error);
    return null; // If it fails, save null so the app doesn't crash
  }
};
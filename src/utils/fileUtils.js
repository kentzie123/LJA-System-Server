import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export const saveBase64Image = async (base64String, userId, type) => {
  // 1. If there's no photo, or it's already a saved URL, return it as-is
  if (!base64String) return null;
  if (base64String.startsWith('/uploads/') || base64String.startsWith('http')) {
    return base64String;
  }

  try {
    // 2. Extract the raw image data
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    
    // Convert the text back into a binary buffer
    const imageData = Buffer.from(matches[2], 'base64');
    
    // 3. FORCE WEBP EXTENSION
    const filename = `user_${userId}_${type}_${Date.now()}.webp`;
    
    // 4. Define the folder path dynamically
    const folderName = type === 'profile' ? 'profiles' : 'attendance';
    const uploadDir = path.join(process.cwd(), 'uploads', folderName);

    // 5. Ensure the folder exists
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);

    // 6. Use Sharp to convert to WebP and compress to 80% quality
    await sharp(imageData)
      .webp({ quality: 80 }) // 80 is the sweet spot for quality vs file size
      .toFile(filePath);

    // 7. Return the dynamic URL path
    return `/uploads/${folderName}/${filename}`;
    
  } catch (error) {
    console.error("Error saving image to disk:", error);
    return null;
  }
};

export const deleteLocalFile = async (fileUrl) => {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  try {
    const filePath = path.join(process.cwd(), fileUrl);
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Note: Could not delete local file:", fileUrl, error.message);
  }
};
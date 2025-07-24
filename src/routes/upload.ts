import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { supabase } from '../config/database';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/profiles/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload profile picture
router.post('/profile-picture', upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate the URL for the uploaded file
    const fileUrl = `/uploads/profiles/${req.file.filename}`;

    res.json({
      message: 'Profile picture uploaded successfully',
      profileImageUrl: fileUrl,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Update user profile picture in database
router.patch('/update-profile-picture', authenticateToken, async (req, res) => {
  try {
    const { profileImageUrl } = req.body;
    const userId = req.user!.id;

    if (!profileImageUrl) {
      return res.status(400).json({ error: 'Profile image URL is required' });
    }

    // Update user profile in database
    const { error } = await supabase
      .from('users')
      .update({ profile_image_url: profileImageUrl })
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Profile picture updated successfully' });

  } catch (error) {
    console.error('Profile picture update error:', error);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

export default router; 
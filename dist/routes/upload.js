"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const router = express_1.default.Router();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/profiles/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image files are allowed!'), false);
    }
};
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: fileFilter
});
router.post('/profile-picture', upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileUrl = `/uploads/profiles/${req.file.filename}`;
        res.json({
            message: 'Profile picture uploaded successfully',
            profileImageUrl: fileUrl,
            filename: req.file.filename
        });
    }
    catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});
router.patch('/update-profile-picture', auth_1.authenticateToken, async (req, res) => {
    try {
        const { profileImageUrl } = req.body;
        const userId = req.user.id;
        if (!profileImageUrl) {
            return res.status(400).json({ error: 'Profile image URL is required' });
        }
        const { error } = await database_1.supabase
            .from('users')
            .update({ profile_image_url: profileImageUrl })
            .eq('user_id', userId);
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: 'Profile picture updated successfully' });
    }
    catch (error) {
        console.error('Profile picture update error:', error);
        res.status(500).json({ error: 'Failed to update profile picture' });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map
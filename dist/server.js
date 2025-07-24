"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const events_1 = __importDefault(require("./routes/events"));
const follows_1 = __importDefault(require("./routes/follows"));
const messages_1 = __importDefault(require("./routes/messages"));
const payments_1 = __importDefault(require("./routes/payments"));
const dropdown_1 = __importDefault(require("./routes/dropdown"));
const upload_1 = __importDefault(require("./routes/upload"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
            frameSrc: ["'self'", "https://js.stripe.com", "https://*.stripe.com"],
            connectSrc: ["'self'", "wss:", "ws:", "https://api.stripe.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
}));
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.get('/verify-email', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/verify-email.html'));
});
app.get('/about.html', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/about.html'));
});
app.get('/contact.html', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/contact.html'));
});
console.log('Registering API routes...');
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/events', events_1.default);
app.use('/api/follows', (req, res, next) => {
    console.log(`Follow route hit: ${req.method} ${req.originalUrl}`);
    next();
}, follows_1.default);
app.use('/api/messages', (req, res, next) => {
    console.log(`Messages route hit: ${req.method} ${req.originalUrl}`);
    next();
}, messages_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/dropdown', dropdown_1.default);
app.use('/api/upload', upload_1.default);
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });
    socket.on('send_message', (data) => {
        socket.to(data.receiver_id).emit('new_message', data);
    });
    socket.on('typing', (data) => {
        socket.to(data.receiver_id).emit('user_typing', {
            sender_id: data.sender_id,
            is_typing: data.is_typing
        });
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});
app.use('/api/*', (req, res) => {
    console.log(`404 - API route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'API route not found' });
});
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
server.listen(PORT, () => {
    console.log(`🚀 Cheer Network server running on port ${PORT}`);
    console.log(`📱 Visit: http://localhost:${PORT}`);
    console.log(`🔌 Socket.io server ready for real-time features`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
//# sourceMappingURL=server.js.map
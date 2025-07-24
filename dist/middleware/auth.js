"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAthleteRole = exports.requireClinicianRole = exports.requireRole = exports.authenticateToken = void 0;
const database_1 = require("../config/database");
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const { data: { user }, error } = await database_1.supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const { data: userProfile, error: profileError } = await database_1.supabase
            .from('users')
            .select('role')
            .eq('user_id', user.id)
            .single();
        req.user = {
            id: user.id,
            email: user.email || '',
            role: userProfile?.role
        };
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        console.log('Role check:', {
            user: req.user,
            requiredRoles: roles,
            userRole: req.user?.role
        });
        if (!req.user) {
            console.log('No user in request - authentication required');
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!req.user.role || !roles.includes(req.user.role)) {
            console.log('Insufficient permissions:', {
                userRole: req.user.role,
                requiredRoles: roles
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        console.log('Role check passed');
        next();
    };
};
exports.requireRole = requireRole;
exports.requireClinicianRole = (0, exports.requireRole)(['clinician']);
exports.requireAthleteRole = (0, exports.requireRole)(['athlete']);
//# sourceMappingURL=auth.js.map
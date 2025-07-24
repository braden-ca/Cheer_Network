import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user profile to include role
    const { data: userProfile, error: profileError } = await supabase
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
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

export const requireClinicianRole = requireRole(['clinician']);
export const requireAthleteRole = requireRole(['athlete']); 
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
router.get('/clinicians', auth_1.authenticateToken, async (req, res) => {
    try {
        console.log('Getting clinicians...');
        const { page = 1, limit = 20, specialty, experience } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let query = database_1.supabaseAdmin
            .from('clinician_profiles')
            .select(`
        clinician_id,
        specialties,
        years_experience,
        verified,
        users!inner(
          user_id,
          first_name,
          last_name,
          bio,
          profile_image_url
        )
      `, { count: 'exact' });
        if (specialty) {
            query = query.contains('specialties', [specialty]);
        }
        if (experience) {
            query = query.gte('years_experience', Number(experience));
        }
        const { data: clinicians, error, count } = await database_1.supabase
            .from('clinician_profiles')
            .select(`
        *,
        users!inner(user_id, first_name, last_name, bio, profile_image_url, created_at)
      `, { count: 'exact' })
            .range(offset, offset + Number(limit) - 1)
            .order('clinician_id', { ascending: true });
        if (error) {
            console.error('Supabase query error:', error);
            return res.status(400).json({ error: error.message });
        }
        console.log('Clinicians data retrieved:', clinicians?.length || 0, 'records');
        if (!clinicians || clinicians.length === 0) {
            return res.json({
                clinicians: [],
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: 0,
                    totalPages: 0
                }
            });
        }
        const formattedClinicians = clinicians.map(clinician => {
            let user = {};
            if (Array.isArray(clinician.users)) {
                user = clinician.users[0] || {};
            }
            else if (clinician.users) {
                user = clinician.users;
            }
            return {
                user_id: user.user_id,
                clinician_id: clinician.clinician_id,
                first_name: user.first_name || 'Unknown',
                last_name: user.last_name || 'Coach',
                bio: user.bio || 'Professional coach',
                profile_image_url: user.profile_image_url,
                specialties: clinician.specialties || [],
                years_experience: clinician.years_experience || 0,
                verified: clinician.verified || false,
                rating: 4.5,
                total_reviews: 0,
                city: clinician.city,
                state: clinician.state,
                location: clinician.city && clinician.state ? `${clinician.city}, ${clinician.state}` : clinician.city || clinician.state || null,
                current_school: clinician.current_school,
                certifications: clinician.certifications || [],
                hourly_rate: clinician.hourly_rate
            };
        });
        console.log('Formatted clinicians:', formattedClinicians);
        res.json({
            clinicians: formattedClinicians,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Get clinicians error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/clinicians/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: clinician, error } = await database_1.supabase
            .from('clinician_profiles')
            .select(`
        *,
        users!inner(user_id, first_name, last_name, bio, profile_image_url, created_at)
      `)
            .eq('clinician_id', id)
            .single();
        if (error) {
            return res.status(404).json({ error: 'Clinician not found' });
        }
        const { data: recentEvents } = await database_1.supabase
            .from('events')
            .select('event_id, title, start_date, location, price, current_registrations, max_athletes')
            .eq('clinician_id', id)
            .gte('start_date', new Date().toISOString())
            .order('start_date', { ascending: true })
            .limit(5);
        res.json({
            clinician: {
                ...clinician,
                recentEvents: recentEvents || []
            }
        });
    }
    catch (error) {
        console.error('Clinician fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/clinicians/profile', auth_1.authenticateToken, auth_1.requireClinicianRole, (0, validation_1.validateRequest)(validation_1.clinicianProfileSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { specialties, yearsExperience, certifications, location, hourlyRate } = req.body;
        const { data, error } = await database_1.supabase
            .from('clinician_profiles')
            .update({
            specialties,
            years_experience: yearsExperience,
            certifications,
            location,
            hourly_rate: hourlyRate
        })
            .eq('clinician_id', userId)
            .select(`
        *,
        users!inner(user_id, first_name, last_name, bio, profile_image_url)
      `)
            .single();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ profile: data });
    }
    catch (error) {
        console.error('Clinician profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/athletes/profile', auth_1.authenticateToken, auth_1.requireAthleteRole, (0, validation_1.validateRequest)(validation_1.athleteProfileSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { age, skillLevel, teamAffiliation, goals, location } = req.body;
        const { data, error } = await database_1.supabase
            .from('athlete_profiles')
            .update({
            age,
            skill_level: skillLevel,
            team_affiliation: teamAffiliation,
            goals,
            location
        })
            .eq('athlete_id', userId)
            .select(`
        *,
        users!inner(user_id, first_name, last_name, bio, profile_image_url)
      `)
            .single();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ profile: data });
    }
    catch (error) {
        console.error('Athlete profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/athletes/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user.id;
        const { data: athlete, error } = await database_1.supabase
            .from('athlete_profiles')
            .select(`
        *,
        users!inner(user_id, first_name, last_name, bio, profile_image_url, created_at)
      `)
            .eq('athlete_id', id)
            .single();
        if (error) {
            return res.status(404).json({ error: 'Athlete not found' });
        }
        let canViewProfile = false;
        if (currentUserId === id) {
            canViewProfile = true;
        }
        else {
            const { data: connection } = await database_1.supabase
                .from('follow_relationships')
                .select('status')
                .eq('athlete_id', id)
                .eq('clinician_id', currentUserId)
                .eq('status', 'accepted')
                .single();
            canViewProfile = !!connection;
        }
        if (!canViewProfile) {
            return res.status(403).json({ error: 'Not authorized to view this profile' });
        }
        let recentRegistrations = null;
        if (currentUserId === id) {
            const { data } = await database_1.supabase
                .from('event_registrations')
                .select(`
          registration_id,
          payment_status,
          registered_at,
          events!inner(event_id, title, start_date, location)
        `)
                .eq('athlete_id', id)
                .order('registered_at', { ascending: false })
                .limit(5);
            recentRegistrations = data;
        }
        res.json({
            athlete: {
                ...athlete,
                recentRegistrations
            }
        });
    }
    catch (error) {
        console.error('Athlete fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        if (userRole === 'clinician') {
            const { data: profile, error } = await database_1.supabase
                .from('clinician_profiles')
                .select(`
          *,
          users!inner(*)
        `)
                .eq('clinician_id', userId)
                .single();
            if (error) {
                return res.status(400).json({ error: error.message });
            }
            const { count: followersCount } = await database_1.supabase
                .from('follow_relationships')
                .select('*', { count: 'exact' })
                .eq('clinician_id', userId)
                .eq('status', 'accepted');
            const { data: pendingRequests } = await database_1.supabase
                .from('follow_relationships')
                .select(`
          follow_id,
          requested_at,
          athlete_profiles!inner(
            athlete_id,
            users!inner(first_name, last_name, profile_image_url)
          )
        `)
                .eq('clinician_id', userId)
                .eq('status', 'pending')
                .order('requested_at', { ascending: false });
            const { count: eventsCreatedCount } = await database_1.supabase
                .from('events')
                .select('*', { count: 'exact' })
                .eq('clinician_id', userId);
            const { data: athletesTrained } = await database_1.supabase
                .from('event_registrations')
                .select(`
          athlete_id,
          events!inner(clinician_id)
        `)
                .eq('events.clinician_id', userId)
                .eq('payment_status', 'paid');
            const uniqueAthletesTrained = new Set(athletesTrained?.map(reg => reg.athlete_id) || []).size;
            const { data: earningsData } = await database_1.supabase
                .from('event_registrations')
                .select(`
          amount_paid,
          events!inner(clinician_id)
        `)
                .eq('events.clinician_id', userId)
                .eq('payment_status', 'paid');
            const totalEarnings = earningsData?.reduce((sum, reg) => sum + (reg.amount_paid || 0), 0) || 0;
            res.json({
                ...profile.users,
                role: userRole,
                clinician_profile: profile,
                stats: {
                    followersCount: followersCount || 0,
                    pendingRequestsCount: pendingRequests?.length || 0,
                    eventsCreatedCount: eventsCreatedCount || 0,
                    athletesTrainedCount: uniqueAthletesTrained,
                    totalEarnings: totalEarnings
                },
                pendingRequests: pendingRequests || []
            });
        }
        else if (userRole === 'athlete') {
            const { data: profile, error } = await database_1.supabase
                .from('athlete_profiles')
                .select(`
          *,
          users!inner(*)
        `)
                .eq('athlete_id', userId)
                .single();
            if (error) {
                return res.status(400).json({ error: error.message });
            }
            const { count: followingCount } = await database_1.supabase
                .from('follow_relationships')
                .select('*', { count: 'exact' })
                .eq('athlete_id', userId)
                .eq('status', 'accepted');
            const { count: eventsCount } = await database_1.supabase
                .from('event_registrations')
                .select('*', { count: 'exact' })
                .eq('athlete_id', userId)
                .eq('payment_status', 'paid');
            res.json({
                ...profile.users,
                role: userRole,
                athlete_profile: profile,
                stats: {
                    followingCount: followingCount || 0,
                    eventsCount: eventsCount || 0
                }
            });
        }
        else {
            return res.status(400).json({ error: 'Invalid user role' });
        }
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { first_name, last_name, bio, profile_image_url, athlete_profile } = req.body;
        const userUpdateData = {};
        if (first_name !== undefined)
            userUpdateData.first_name = first_name;
        if (last_name !== undefined)
            userUpdateData.last_name = last_name;
        if (bio !== undefined)
            userUpdateData.bio = bio;
        if (profile_image_url !== undefined)
            userUpdateData.profile_image_url = profile_image_url;
        if (Object.keys(userUpdateData).length > 0) {
            const { error: userError } = await database_1.supabase
                .from('users')
                .update(userUpdateData)
                .eq('user_id', userId);
            if (userError) {
                return res.status(400).json({ error: userError.message });
            }
        }
        if (userRole === 'athlete' && athlete_profile) {
            const athleteUpdateData = {};
            if (athlete_profile.age !== undefined)
                athleteUpdateData.age = athlete_profile.age;
            if (athlete_profile.skill_level !== undefined)
                athleteUpdateData.skill_level = athlete_profile.skill_level;
            if (athlete_profile.team_affiliation !== undefined)
                athleteUpdateData.team_affiliation = athlete_profile.team_affiliation;
            if (athlete_profile.location !== undefined)
                athleteUpdateData.location = athlete_profile.location;
            if (athlete_profile.goals !== undefined)
                athleteUpdateData.goals = athlete_profile.goals;
            if (Object.keys(athleteUpdateData).length > 0) {
                const { error: athleteError } = await database_1.supabase
                    .from('athlete_profiles')
                    .update(athleteUpdateData)
                    .eq('athlete_id', userId);
                if (athleteError) {
                    return res.status(400).json({ error: athleteError.message });
                }
            }
        }
        const response = await fetch(`${req.protocol}://${req.get('host')}/api/users/profile`, {
            headers: {
                'Authorization': req.headers.authorization,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            const updatedProfile = await response.json();
            res.json(updatedProfile);
        }
        else {
            res.status(500).json({ error: 'Failed to fetch updated profile' });
        }
    }
    catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const { q, role, limit = 10 } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }
        let query = database_1.supabase
            .from('users')
            .select(`
        user_id,
        role,
        first_name,
        last_name,
        bio,
        profile_image_url,
        clinician_profiles(specialties, location, verified),
        athlete_profiles(skill_level, location)
      `)
            .limit(limit);
        if (role && ['athlete', 'clinician'].includes(role)) {
            query = query.eq('role', role);
        }
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,bio.ilike.%${q}%`);
        const { data: users, error } = await query;
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ users });
    }
    catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/dashboard', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        if (userRole === 'clinician') {
            const [eventsResult, followersResult, messagesResult] = await Promise.all([
                database_1.supabase
                    .from('events')
                    .select('event_id, title, start_date, current_registrations, max_athletes')
                    .eq('clinician_id', userId)
                    .gte('start_date', new Date().toISOString())
                    .order('start_date', { ascending: true })
                    .limit(5),
                database_1.supabase
                    .from('follow_relationships')
                    .select(`
            follow_id,
            requested_at,
            athlete_profiles!inner(
              athlete_id,
              users!inner(first_name, last_name, profile_image_url)
            )
          `)
                    .eq('clinician_id', userId)
                    .eq('status', 'accepted')
                    .order('responded_at', { ascending: false })
                    .limit(5),
                database_1.supabase
                    .from('messages')
                    .select('*', { count: 'exact' })
                    .eq('receiver_id', userId)
                    .eq('read', false)
            ]);
            res.json({
                upcomingEvents: eventsResult.data || [],
                recentFollowers: followersResult.data || [],
                unreadMessagesCount: messagesResult.count || 0
            });
        }
        else if (userRole === 'athlete') {
            const [eventsResult, followingResult, messagesResult, newsResult] = await Promise.all([
                database_1.supabase
                    .from('event_registrations')
                    .select(`
            registration_id,
            events!inner(event_id, title, start_date, location, clinician_id,
              clinician_profiles!inner(
                users!inner(first_name, last_name)
              )
            )
          `)
                    .eq('athlete_id', userId)
                    .eq('payment_status', 'paid')
                    .gte('events.start_date', new Date().toISOString())
                    .order('events.start_date', { ascending: true })
                    .limit(5),
                database_1.supabase
                    .from('follow_relationships')
                    .select(`
            follow_id,
            clinician_profiles!inner(
              clinician_id,
              users!inner(first_name, last_name, profile_image_url)
            )
          `)
                    .eq('athlete_id', userId)
                    .eq('status', 'accepted')
                    .limit(5),
                database_1.supabase
                    .from('messages')
                    .select('*', { count: 'exact' })
                    .eq('receiver_id', userId)
                    .eq('read', false),
                database_1.supabase
                    .from('news_posts')
                    .select('post_id, title, content, featured_image_url, created_at')
                    .eq('published', true)
                    .order('created_at', { ascending: false })
                    .limit(3)
            ]);
            res.json({
                upcomingEvents: eventsResult.data || [],
                following: followingResult.data || [],
                unreadMessagesCount: messagesResult.count || 0,
                recentNews: newsResult.data || []
            });
        }
        else {
            return res.status(400).json({ error: 'Invalid user role' });
        }
    }
    catch (error) {
        console.error('Dashboard fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const emailService_1 = require("../services/emailService");
const router = express_1.default.Router();
const emailService = emailService_1.EmailService.getInstance();
router.get('/status/:clinicianId', auth_1.authenticateToken, auth_1.requireAthleteRole, async (req, res) => {
    try {
        const athleteId = req.user.id;
        const { clinicianId } = req.params;
        const { data: followRelationship, error } = await database_1.supabase
            .from('follow_relationships')
            .select('status')
            .eq('athlete_id', athleteId)
            .eq('clinician_id', clinicianId)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error('Error checking connection status:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        const status = followRelationship?.status || 'none';
        res.json({ status });
    }
    catch (error) {
        console.error('Check connection status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/request', auth_1.authenticateToken, auth_1.requireAthleteRole, async (req, res) => {
    try {
        console.log('Follow request received:', {
            athleteId: req.user.id,
            userRole: req.user.role,
            body: req.body
        });
        const athleteId = req.user.id;
        const { clinicianId } = req.body;
        if (!clinicianId) {
            console.log('Missing clinician ID in request');
            return res.status(400).json({ error: 'Clinician ID is required' });
        }
        console.log('Looking up clinician with ID:', clinicianId);
        const { data: allClinicians, error: allCliniciansError } = await database_1.supabase
            .from('clinician_profiles')
            .select('clinician_id, users(first_name, last_name)');
        console.log('All clinicians in database:', allClinicians);
        console.log('Query error for all clinicians:', allCliniciansError);
        const { data: clinician, error: clinicianError } = await database_1.supabase
            .from('clinician_profiles')
            .select(`
        clinician_id,
        users(first_name, last_name, user_id)
      `)
            .eq('clinician_id', clinicianId)
            .single();
        console.log('Clinician lookup result:', {
            clinician,
            clinicianError,
            requestedId: clinicianId,
            foundId: clinician?.clinician_id
        });
        if (clinicianError || !clinician) {
            console.log('Clinician not found - details:', {
                error: clinicianError,
                clinician,
                clinicianId,
                errorCode: clinicianError?.code,
                errorMessage: clinicianError?.message
            });
            return res.status(404).json({
                error: 'Clinician not found',
                debug: {
                    requestedId: clinicianId,
                    queryError: clinicianError?.message,
                    availableIds: allClinicians?.map(c => c.clinician_id) || []
                }
            });
        }
        const { data: existingFollow } = await database_1.supabase
            .from('follow_relationships')
            .select('follow_id, status')
            .eq('athlete_id', athleteId)
            .eq('clinician_id', clinicianId)
            .single();
        if (existingFollow) {
            if (existingFollow.status === 'pending') {
                return res.status(400).json({ error: 'Follow request already pending' });
            }
            else if (existingFollow.status === 'accepted') {
                return res.status(400).json({ error: 'Already following this clinician' });
            }
            else if (existingFollow.status === 'rejected') {
                const { data: updatedFollow, error: updateError } = await database_1.supabase
                    .from('follow_relationships')
                    .update({
                    status: 'pending',
                    requested_at: new Date().toISOString(),
                    responded_at: null
                })
                    .eq('follow_id', existingFollow.follow_id)
                    .select()
                    .single();
                if (updateError) {
                    return res.status(400).json({ error: updateError.message });
                }
                const { data: athlete } = await database_1.supabase
                    .from('users')
                    .select('first_name, last_name')
                    .eq('user_id', athleteId)
                    .single();
                if (athlete && clinician.users.length > 0) {
                    const { data: clinicianUser } = await database_1.supabase
                        .from('users')
                        .select('email')
                        .eq('user_id', clinician.users[0].user_id)
                        .single();
                    if (clinicianUser?.email) {
                        const athleteName = `${athlete.first_name} ${athlete.last_name}`;
                        const dashboardLink = `${process.env.CORS_ORIGIN}/dashboard`;
                        await emailService.sendFollowRequestNotification(clinicianUser.email, athleteName, dashboardLink);
                    }
                }
                return res.status(201).json({
                    message: 'Follow request sent successfully',
                    followRelationship: updatedFollow
                });
            }
        }
        const { data: followRelationship, error } = await database_1.supabase
            .from('follow_relationships')
            .insert({
            athlete_id: athleteId,
            clinician_id: clinicianId,
            status: 'pending'
        })
            .select()
            .single();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        const { data: athlete } = await database_1.supabase
            .from('users')
            .select('first_name, last_name')
            .eq('user_id', athleteId)
            .single();
        if (athlete && clinician.users.length > 0) {
            const { data: clinicianUser } = await database_1.supabase
                .from('users')
                .select('email')
                .eq('user_id', clinician.users[0].user_id)
                .single();
            if (clinicianUser?.email) {
                const athleteName = `${athlete.first_name} ${athlete.last_name}`;
                const dashboardLink = `${process.env.CORS_ORIGIN}/dashboard`;
                await emailService.sendFollowRequestNotification(clinicianUser.email, athleteName, dashboardLink);
            }
        }
        res.status(201).json({
            message: 'Follow request sent successfully',
            followRelationship
        });
    }
    catch (error) {
        console.error('Follow request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/request/:id/respond', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;
        const clinicianId = req.user.id;
        console.log('Follow response request:', {
            followId: id,
            action,
            clinicianId,
            userRole: req.user.role
        });
        if (!['accept', 'reject'].includes(action)) {
            console.log('Invalid action provided:', action);
            return res.status(400).json({ error: 'Action must be "accept" or "reject"' });
        }
        const { data: followRequest, error: requestError } = await database_1.supabase
            .from('follow_relationships')
            .select('*')
            .eq('follow_id', id)
            .eq('clinician_id', clinicianId)
            .eq('status', 'pending')
            .single();
        console.log('Follow request lookup:', {
            found: !!followRequest,
            error: requestError?.message,
            followRequest
        });
        if (requestError || !followRequest) {
            console.log('Follow request not found or error:', requestError);
            return res.status(404).json({ error: 'Follow request not found' });
        }
        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        const { data: updatedFollow, error: updateError } = await database_1.supabase
            .from('follow_relationships')
            .update({
            status: newStatus,
            responded_at: new Date().toISOString()
        })
            .eq('follow_id', id)
            .select()
            .single();
        console.log('Follow request update:', {
            success: !!updatedFollow,
            error: updateError?.message,
            updatedFollow
        });
        if (updateError) {
            console.error('Update error details:', updateError);
            return res.status(400).json({ error: updateError.message });
        }
        const [athleteResult, clinicianResult] = await Promise.all([
            database_1.supabase
                .from('users')
                .select('first_name, last_name, email')
                .eq('user_id', followRequest.athlete_id)
                .single(),
            database_1.supabase
                .from('users')
                .select('first_name, last_name')
                .eq('user_id', clinicianId)
                .single()
        ]);
        console.log('User info lookup:', {
            athlete: athleteResult.data,
            clinician: clinicianResult.data,
            errors: {
                athlete: athleteResult.error?.message,
                clinician: clinicianResult.error?.message
            }
        });
        if (action === 'accept' && athleteResult.data && clinicianResult.data) {
            const athleteName = `${athleteResult.data.first_name} ${athleteResult.data.last_name}`;
            const clinicianName = `${clinicianResult.data.first_name} ${clinicianResult.data.last_name}`;
            console.log(`Follow request accepted: ${athleteName} -> ${clinicianName}`);
        }
        res.json({
            message: `Follow request ${action}ed successfully`,
            followRelationship: updatedFollow
        });
    }
    catch (error) {
        console.error('Follow response error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/pending', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const clinicianId = req.user.id;
        const { data: pendingRequests, error } = await database_1.supabase
            .from('follow_relationships')
            .select(`
        follow_id,
        requested_at,
        athlete_profiles!inner(
          athlete_id,
          age,
          skill_level,
          team_affiliation,
          users!inner(first_name, last_name, bio, profile_image_url)
        )
      `)
            .eq('clinician_id', clinicianId)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ pendingRequests });
    }
    catch (error) {
        console.error('Pending requests fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/followers', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const clinicianId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const { data: followers, error, count } = await database_1.supabase
            .from('follow_relationships')
            .select(`
        follow_id,
        requested_at,
        responded_at,
        athlete_profiles!inner(
          athlete_id,
          age,
          skill_level,
          team_affiliation,
          location,
          users!inner(first_name, last_name, bio, profile_image_url)
        )
      `, { count: 'exact' })
            .eq('clinician_id', clinicianId)
            .eq('status', 'accepted')
            .range(offset, offset + Number(limit) - 1)
            .order('responded_at', { ascending: false });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({
            followers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Followers fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/following', auth_1.authenticateToken, auth_1.requireAthleteRole, async (req, res) => {
    try {
        const athleteId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const { data: following, error, count } = await database_1.supabase
            .from('follow_relationships')
            .select(`
        follow_id,
        requested_at,
        responded_at,
        status,
        clinician_profiles!inner(
          clinician_id,
          specialties,
          years_experience,
          location,
          verified,
          rating,
          users!inner(first_name, last_name, bio, profile_image_url)
        )
      `, { count: 'exact' })
            .eq('athlete_id', athleteId)
            .in('status', ['accepted', 'pending'])
            .range(offset, offset + Number(limit) - 1)
            .order('responded_at', { ascending: false });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({
            following,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Following fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/sent', auth_1.authenticateToken, auth_1.requireAthleteRole, async (req, res) => {
    try {
        const athleteId = req.user.id;
        const { data: pendingRequests, error } = await database_1.supabase
            .from('follow_relationships')
            .select(`
        follow_id,
        clinician_id,
        status,
        requested_at,
        clinician_profiles!inner(
          clinician_id,
          users!inner(first_name, last_name)
        )
      `)
            .eq('athlete_id', athleteId)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({
            pendingRequests: pendingRequests || []
        });
    }
    catch (error) {
        console.error('Sent requests fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/unfollow/:clinicianId', auth_1.authenticateToken, auth_1.requireAthleteRole, async (req, res) => {
    try {
        const athleteId = req.user.id;
        const { clinicianId } = req.params;
        const { data: deletedFollow, error } = await database_1.supabase
            .from('follow_relationships')
            .delete()
            .eq('athlete_id', athleteId)
            .eq('clinician_id', clinicianId)
            .eq('status', 'accepted')
            .select()
            .single();
        if (error || !deletedFollow) {
            return res.status(404).json({ error: 'Follow relationship not found' });
        }
        res.json({ message: 'Successfully unfollowed clinician' });
    }
    catch (error) {
        console.error('Unfollow error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/remove-follower/:athleteId', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const clinicianId = req.user.id;
        const { athleteId } = req.params;
        const { data: deletedFollow, error } = await database_1.supabase
            .from('follow_relationships')
            .delete()
            .eq('athlete_id', athleteId)
            .eq('clinician_id', clinicianId)
            .eq('status', 'accepted')
            .select()
            .single();
        if (error || !deletedFollow) {
            return res.status(404).json({ error: 'Follow relationship not found' });
        }
        res.json({ message: 'Successfully removed follower' });
    }
    catch (error) {
        console.error('Remove follower error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/status/:clinicianId', auth_1.authenticateToken, auth_1.requireAthleteRole, async (req, res) => {
    try {
        const athleteId = req.user.id;
        const { clinicianId } = req.params;
        const { data: followRelationship, error } = await database_1.supabase
            .from('follow_relationships')
            .select('follow_id, status, requested_at, responded_at')
            .eq('athlete_id', athleteId)
            .eq('clinician_id', clinicianId)
            .single();
        if (error) {
            return res.json({
                status: 'none',
                canFollow: true
            });
        }
        res.json({
            status: followRelationship.status,
            followId: followRelationship.follow_id,
            requestedAt: followRelationship.requested_at,
            respondedAt: followRelationship.responded_at,
            canFollow: followRelationship.status === 'rejected'
        });
    }
    catch (error) {
        console.error('Follow status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/stats', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        if (userRole === 'clinician') {
            const [followersResult, pendingResult] = await Promise.all([
                database_1.supabase
                    .from('follow_relationships')
                    .select('*', { count: 'exact' })
                    .eq('clinician_id', userId)
                    .eq('status', 'accepted'),
                database_1.supabase
                    .from('follow_relationships')
                    .select('*', { count: 'exact' })
                    .eq('clinician_id', userId)
                    .eq('status', 'pending')
            ]);
            res.json({
                followersCount: followersResult.count || 0,
                pendingRequestsCount: pendingResult.count || 0
            });
        }
        else if (userRole === 'athlete') {
            const [followingResult, pendingResult] = await Promise.all([
                database_1.supabase
                    .from('follow_relationships')
                    .select('*', { count: 'exact' })
                    .eq('athlete_id', userId)
                    .eq('status', 'accepted'),
                database_1.supabase
                    .from('follow_relationships')
                    .select('*', { count: 'exact' })
                    .eq('athlete_id', userId)
                    .eq('status', 'pending')
            ]);
            res.json({
                followingCount: followingResult.count || 0,
                pendingRequestsCount: pendingResult.count || 0
            });
        }
        else {
            return res.status(400).json({ error: 'Invalid user role' });
        }
    }
    catch (error) {
        console.error('Follow stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=follows.js.map
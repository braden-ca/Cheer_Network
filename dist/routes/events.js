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
router.get('/', auth_1.authenticateToken, (0, validation_1.validateQuery)(validation_1.eventsQuerySchema), async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;
        const { location, startDate, endDate, maxPrice, specialties, clinicianId } = req.query;
        let query = database_1.supabase
            .from('events')
            .select(`
        *,
        clinician_profiles!left(
          specialties,
          users!inner(first_name, last_name, profile_image_url)
        )
      `)
            .range(offset, offset + limit - 1)
            .order('start_date', { ascending: true });
        query = query.or(`is_private.eq.false,and(is_private.eq.true,clinician_id.eq.${userId})`);
        if (location) {
            query = query.ilike('location', `%${location}%`);
        }
        if (startDate) {
            query = query.gte('start_date', startDate);
        }
        if (endDate) {
            query = query.lte('end_date', endDate);
        }
        if (maxPrice) {
            query = query.lte('price', maxPrice);
        }
        if (clinicianId) {
            query = query.eq('clinician_id', clinicianId);
        }
        const { data: events, error, count } = await query;
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        const filteredEvents = await Promise.all((events || []).map(async (event) => {
            if (!event.is_private) {
                return event;
            }
            if (event.clinician_id === userId) {
                return event;
            }
            const { data: access } = await database_1.supabase
                .from('private_event_access')
                .select('access_id')
                .eq('event_id', event.event_id)
                .eq('athlete_id', userId)
                .single();
            return access ? event : null;
        }));
        const accessibleEvents = filteredEvents.filter(event => event !== null);
        const formattedEvents = await Promise.all(accessibleEvents.map(async (event) => {
            let userRegistration = null;
            if (req.user.role === 'athlete') {
                const { data: registration } = await database_1.supabase
                    .from('event_registrations')
                    .select('registration_id, payment_status, registered_at')
                    .eq('event_id', event.event_id)
                    .eq('athlete_id', userId)
                    .single();
                userRegistration = registration;
            }
            let clinicianName = 'Unknown Clinician';
            if (event.clinician_profiles?.users?.[0]) {
                const user = event.clinician_profiles.users[0];
                clinicianName = `${user.first_name} ${user.last_name}`;
            }
            else {
                const { data: fallbackUser } = await database_1.supabase
                    .from('users')
                    .select('first_name, last_name')
                    .eq('user_id', event.clinician_id)
                    .single();
                if (fallbackUser) {
                    clinicianName = `${fallbackUser.first_name} ${fallbackUser.last_name}`;
                }
            }
            return {
                ...event,
                clinician_name: clinicianName,
                userRegistration
            };
        }));
        res.json({
            events: formattedEvents,
            pagination: {
                page,
                limit,
                total: accessibleEvents.length,
                totalPages: Math.ceil(accessibleEvents.length / limit)
            }
        });
    }
    catch (error) {
        console.error('Events fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        console.log('🔍 FETCHING EVENT WITH ID:', id);
        const { data: event, error } = await database_1.supabase
            .from('events')
            .select(`
        *,
        clinician_profiles!left(
          specialties,
          years_experience,
          verified,
          users!inner(first_name, last_name, bio, profile_image_url)
        )
      `)
            .eq('event_id', id)
            .single();
        console.log('📊 EVENT QUERY RESULT:');
        console.log('Error:', error);
        console.log('Event data:', event);
        if (error) {
            return res.status(404).json({ error: 'Event not found' });
        }
        let canView = false;
        if (!event.is_private) {
            canView = true;
        }
        else if (event.clinician_id === userId) {
            canView = true;
        }
        else {
            const { data: access } = await database_1.supabase
                .from('private_event_access')
                .select('access_id')
                .eq('event_id', id)
                .eq('athlete_id', userId)
                .single();
            canView = !!access;
        }
        if (!canView) {
            return res.status(403).json({ error: 'Not authorized to view this event' });
        }
        let userRegistration = null;
        if (req.user.role === 'athlete') {
            const { data: registration } = await database_1.supabase
                .from('event_registrations')
                .select('registration_id, payment_status, registered_at')
                .eq('event_id', id)
                .eq('athlete_id', userId)
                .single();
            userRegistration = registration;
        }
        console.log('🔍 DEBUGGING EVENT API - EVENT DATA:');
        console.log('Event clinician_id:', event.clinician_id);
        console.log('Event clinician_profiles:', event.clinician_profiles);
        console.log('📞 Fetching clinician user data for clinician_id:', event.clinician_id);
        const { data: clinicianUser, error: clinicianError } = await database_1.supabase
            .from('users')
            .select('first_name, last_name, profile_image_url')
            .eq('user_id', event.clinician_id)
            .single();
        console.log('👤 Clinician user query result:', clinicianUser);
        if (clinicianError) {
            console.log('❌ Clinician user query error:', clinicianError);
        }
        let registrations = null;
        if (event.clinician_id === userId) {
            const { data } = await database_1.supabase
                .from('event_registrations')
                .select(`
          registration_id,
          payment_status,
          registered_at,
          athlete_profiles!inner(
            athlete_id,
            skill_level,
            users!inner(first_name, last_name, profile_image_url)
          )
        `)
                .eq('event_id', id)
                .order('registered_at', { ascending: false });
            registrations = data;
        }
        console.log('📤 SENDING EVENT RESPONSE:');
        console.log('Event title:', event.title);
        console.log('Event clinician_id:', event.clinician_id);
        console.log('Event clinician_profiles:', event.clinician_profiles);
        console.log('Fallback clinicianUser:', clinicianUser);
        res.json({
            event,
            userRegistration,
            registrations,
            clinicianUser
        });
    }
    catch (error) {
        console.error('Event fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', auth_1.authenticateToken, auth_1.requireClinicianRole, (0, validation_1.validateRequest)(validation_1.createEventFrontendSchema), async (req, res) => {
    try {
        const clinicianId = req.user.id;
        const { title, description, location, date, duration, price, max_athletes, overnight_camp, required_items, recommended_items } = req.body;
        const startDate = new Date(date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration.days);
        endDate.setHours(endDate.getHours() + duration.hours);
        endDate.setMinutes(endDate.getMinutes() + duration.minutes);
        let requirements = '';
        if (required_items && required_items.length > 0) {
            requirements += 'Required items: ' + required_items.join(', ') + '\n';
        }
        if (recommended_items && recommended_items.length > 0) {
            requirements += 'Recommended items: ' + recommended_items.join(', ');
        }
        const { data: event, error } = await database_1.supabase
            .from('events')
            .insert({
            clinician_id: clinicianId,
            title,
            description,
            location,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            max_athletes: max_athletes || 30,
            price,
            is_private: overnight_camp,
            image_url: null,
            requirements: requirements.trim()
        })
            .select(`
        *,
        clinician_profiles!inner(
          users!inner(first_name, last_name)
        )
      `)
            .single();
        if (error) {
            console.error('Database error:', error);
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json({ event });
    }
    catch (error) {
        console.error('Event creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', auth_1.authenticateToken, auth_1.requireClinicianRole, (0, validation_1.validateRequest)(validation_1.updateEventSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicianId = req.user.id;
        const updateData = req.body;
        const dbUpdateData = {};
        if (updateData.startDate)
            dbUpdateData.start_date = updateData.startDate;
        if (updateData.endDate)
            dbUpdateData.end_date = updateData.endDate;
        if (updateData.maxAthletes)
            dbUpdateData.max_athletes = updateData.maxAthletes;
        if (updateData.isPrivate !== undefined)
            dbUpdateData.is_private = updateData.isPrivate;
        if (updateData.imageUrl)
            dbUpdateData.image_url = updateData.imageUrl;
        ['title', 'description', 'location', 'price', 'requirements'].forEach(field => {
            if (updateData[field] !== undefined) {
                dbUpdateData[field] = updateData[field];
            }
        });
        const { data: existingEvent } = await database_1.supabase
            .from('events')
            .select('clinician_id')
            .eq('event_id', id)
            .single();
        if (!existingEvent || existingEvent.clinician_id !== clinicianId) {
            return res.status(403).json({ error: 'Not authorized to update this event' });
        }
        const { data: event, error } = await database_1.supabase
            .from('events')
            .update(dbUpdateData)
            .eq('event_id', id)
            .select(`
        *,
        clinician_profiles!inner(
          users!inner(first_name, last_name)
        )
      `)
            .single();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ event });
    }
    catch (error) {
        console.error('Event update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const { id } = req.params;
        const clinicianId = req.user.id;
        const { data: existingEvent } = await database_1.supabase
            .from('events')
            .select('clinician_id')
            .eq('event_id', id)
            .single();
        if (!existingEvent || existingEvent.clinician_id !== clinicianId) {
            return res.status(403).json({ error: 'Not authorized to delete this event' });
        }
        const { data: paidRegistrations } = await database_1.supabase
            .from('event_registrations')
            .select('registration_id')
            .eq('event_id', id)
            .eq('payment_status', 'paid');
        if (paidRegistrations && paidRegistrations.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete event with paid registrations. Please process refunds first.'
            });
        }
        const { error } = await database_1.supabase
            .from('events')
            .delete()
            .eq('event_id', id);
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: 'Event deleted successfully' });
    }
    catch (error) {
        console.error('Event deletion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/register', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        if (req.user.role !== 'athlete') {
            return res.status(403).json({ error: 'Only athletes can register for events' });
        }
        const { data: event, error: eventError } = await database_1.supabase
            .from('events')
            .select('*')
            .eq('event_id', id)
            .single();
        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (event.current_registrations >= event.max_athletes) {
            return res.status(400).json({ error: 'Event is full' });
        }
        const { data: existingRegistration } = await database_1.supabase
            .from('event_registrations')
            .select('registration_id')
            .eq('event_id', id)
            .eq('athlete_id', userId)
            .single();
        if (existingRegistration) {
            return res.status(400).json({ error: 'Already registered for this event' });
        }
        if (event.is_private) {
            const { data: access } = await database_1.supabase
                .from('private_event_access')
                .select('access_id')
                .eq('event_id', id)
                .eq('athlete_id', userId)
                .single();
            if (!access) {
                return res.status(403).json({ error: 'Not authorized to register for this private event' });
            }
        }
        const paymentStatus = event.price > 0 ? 'pending' : 'paid';
        const { data: registration, error: regError } = await database_1.supabase
            .from('event_registrations')
            .insert({
            event_id: id,
            athlete_id: userId,
            payment_status: paymentStatus,
            amount_paid: event.price
        })
            .select()
            .single();
        if (regError) {
            return res.status(400).json({ error: regError.message });
        }
        res.status(201).json({
            registration,
            requiresPayment: event.price > 0,
            amount: event.price
        });
    }
    catch (error) {
        console.error('Event registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id/register', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: registration, error: regError } = await database_1.supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', id)
            .eq('athlete_id', userId)
            .single();
        if (regError || !registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }
        if (registration.payment_status === 'paid') {
            return res.status(400).json({
                error: 'Cannot unregister from paid event. Please contact support for refunds.'
            });
        }
        const { error } = await database_1.supabase
            .from('event_registrations')
            .delete()
            .eq('registration_id', registration.registration_id);
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: 'Successfully unregistered from event' });
    }
    catch (error) {
        console.error('Event unregistration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/grant-access', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const { id } = req.params;
        const clinicianId = req.user.id;
        const { athleteIds } = req.body;
        if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
            return res.status(400).json({ error: 'Athletic IDs array is required' });
        }
        const { data: event } = await database_1.supabase
            .from('events')
            .select('clinician_id, is_private')
            .eq('event_id', id)
            .single();
        if (!event || event.clinician_id !== clinicianId) {
            return res.status(403).json({ error: 'Not authorized to manage this event' });
        }
        if (!event.is_private) {
            return res.status(400).json({ error: 'Cannot grant access to public events' });
        }
        const accessRecords = athleteIds.map((athleteId) => ({
            event_id: id,
            athlete_id: athleteId
        }));
        const { data, error } = await database_1.supabase
            .from('private_event_access')
            .upsert(accessRecords, { onConflict: 'event_id,athlete_id' })
            .select();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({
            message: 'Access granted successfully',
            accessRecords: data
        });
    }
    catch (error) {
        console.error('Grant access error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id/revoke-access/:athleteId', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const { id, athleteId } = req.params;
        const clinicianId = req.user.id;
        const { data: event } = await database_1.supabase
            .from('events')
            .select('clinician_id')
            .eq('event_id', id)
            .single();
        if (!event || event.clinician_id !== clinicianId) {
            return res.status(403).json({ error: 'Not authorized to manage this event' });
        }
        const { error } = await database_1.supabase
            .from('private_event_access')
            .delete()
            .eq('event_id', id)
            .eq('athlete_id', athleteId);
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: 'Access revoked successfully' });
    }
    catch (error) {
        console.error('Revoke access error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id/registrations', auth_1.authenticateToken, auth_1.requireClinicianRole, async (req, res) => {
    try {
        const { id } = req.params;
        const clinicianId = req.user.id;
        const { data: event } = await database_1.supabase
            .from('events')
            .select('clinician_id')
            .eq('event_id', id)
            .single();
        if (!event || event.clinician_id !== clinicianId) {
            return res.status(403).json({ error: 'Not authorized to view registrations for this event' });
        }
        const { data: registrations, error } = await database_1.supabase
            .from('event_registrations')
            .select(`
        *,
        athlete_profiles!inner(
          athlete_id,
          age,
          skill_level,
          team_affiliation,
          users!inner(first_name, last_name, email, profile_image_url)
        )
      `)
            .eq('event_id', id)
            .order('registered_at', { ascending: false });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ registrations });
    }
    catch (error) {
        console.error('Registrations fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=events.js.map
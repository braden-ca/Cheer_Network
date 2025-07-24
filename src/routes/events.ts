import express from 'express';
import { supabase } from '../config/database';
import { authenticateToken, requireClinicianRole } from '../middleware/auth';
import { 
  validateRequest, 
  validateQuery,
  createEventSchema,
  createEventFrontendSchema,
  updateEventSchema,
  paginationSchema,
  eventFiltersSchema,
  eventsQuerySchema 
} from '../middleware/validation';

const router = express.Router();

// Get all events (public + private with access)
router.get('/', authenticateToken, validateQuery(eventsQuerySchema), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query as any;
    const offset = (page - 1) * limit;
    const userId = req.user!.id;
    const { location, startDate, endDate, maxPrice, specialties, clinicianId } = req.query as any;

    let query = supabase
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

    // Filter public events and private events user has access to
    query = query.or(`is_private.eq.false,and(is_private.eq.true,clinician_id.eq.${userId})`);

    // Apply additional filters
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

    // For private events, check if user has explicit access
    const filteredEvents = await Promise.all(
      (events || []).map(async (event) => {
        if (!event.is_private) {
          return event;
        }

        // Check if user is the creator
        if (event.clinician_id === userId) {
          return event;
        }

        // Check if user has explicit access to private event
        const { data: access } = await supabase
          .from('private_event_access')
          .select('access_id')
          .eq('event_id', event.event_id)
          .eq('athlete_id', userId)
          .single();

        return access ? event : null;
      })
    );

    const accessibleEvents = filteredEvents.filter(event => event !== null);

    // For athletes, check registration status for each event
    const formattedEvents = await Promise.all(
      accessibleEvents.map(async (event) => {
        let userRegistration = null;
        
        if (req.user!.role === 'athlete') {
          const { data: registration } = await supabase
            .from('event_registrations')
            .select('registration_id, payment_status, registered_at')
            .eq('event_id', event.event_id)
            .eq('athlete_id', userId)
            .single();
          
          userRegistration = registration;
        }

        // Get clinician name with fallback to direct user query
        let clinicianName = 'Unknown Clinician';
        if (event.clinician_profiles?.users?.[0]) {
          const user = event.clinician_profiles.users[0];
          clinicianName = `${user.first_name} ${user.last_name}`;
        } else {
          // Fallback: fetch user data directly if clinician_profiles doesn't exist
          const { data: fallbackUser } = await supabase
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
      })
    );

    res.json({
      events: formattedEvents,
      pagination: {
        page,
        limit,
        total: accessibleEvents.length,
        totalPages: Math.ceil(accessibleEvents.length / limit)
      }
    });
  } catch (error) {
    console.error('Events fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific event
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    console.log('🔍 FETCHING EVENT WITH ID:', id);
    
    const { data: event, error } = await supabase
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

    // Check if user can view this event
    let canView = false;

    if (!event.is_private) {
      canView = true;
    } else if (event.clinician_id === userId) {
      canView = true;
    } else {
      // Check if user has explicit access to private event
      const { data: access } = await supabase
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

    // Get registration information for current user (if athlete)
    let userRegistration = null;
    if (req.user!.role === 'athlete') {
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('registration_id, payment_status, registered_at')
        .eq('event_id', id)
        .eq('athlete_id', userId)
        .single();

      userRegistration = registration;
    }

    // Always fetch clinician user info directly to ensure we have it
    console.log('🔍 DEBUGGING EVENT API - EVENT DATA:');
    console.log('Event clinician_id:', event.clinician_id);
    console.log('Event clinician_profiles:', event.clinician_profiles);
    
    console.log('📞 Fetching clinician user data for clinician_id:', event.clinician_id);
    const { data: clinicianUser, error: clinicianError } = await supabase
      .from('users')
      .select('first_name, last_name, profile_image_url')
      .eq('user_id', event.clinician_id)
      .single();
    
    console.log('👤 Clinician user query result:', clinicianUser);
    if (clinicianError) {
      console.log('❌ Clinician user query error:', clinicianError);
    }

    // Get list of registered athletes (if user is the clinician)
    let registrations = null;
    if (event.clinician_id === userId) {
      const { data } = await supabase
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
  } catch (error) {
    console.error('Event fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new event
router.post('/', authenticateToken, requireClinicianRole, validateRequest(createEventFrontendSchema), async (req, res) => {
  try {
    const clinicianId = req.user!.id;
    const {
      title,
      description,
      location,
      date,
      duration,
      price,
      max_athletes,
      overnight_camp,
      required_items,
      recommended_items
    } = req.body;

    // Transform frontend data to database format
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    
    // Add duration to start date to get end date
    endDate.setDate(endDate.getDate() + duration.days);
    endDate.setHours(endDate.getHours() + duration.hours);
    endDate.setMinutes(endDate.getMinutes() + duration.minutes);

    // Combine required and recommended items into requirements string
    let requirements = '';
    if (required_items && required_items.length > 0) {
      requirements += 'Required items: ' + required_items.join(', ') + '\n';
    }
    if (recommended_items && recommended_items.length > 0) {
      requirements += 'Recommended items: ' + recommended_items.join(', ');
    }

    const { data: event, error } = await supabase
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
        is_private: overnight_camp, // Use overnight_camp as private indicator
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
  } catch (error) {
    console.error('Event creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event
router.put('/:id', authenticateToken, requireClinicianRole, validateRequest(updateEventSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const clinicianId = req.user!.id;
    const updateData = req.body;

    // Convert camelCase to snake_case for database
    const dbUpdateData: any = {};
    if (updateData.startDate) dbUpdateData.start_date = updateData.startDate;
    if (updateData.endDate) dbUpdateData.end_date = updateData.endDate;
    if (updateData.maxAthletes) dbUpdateData.max_athletes = updateData.maxAthletes;
    if (updateData.isPrivate !== undefined) dbUpdateData.is_private = updateData.isPrivate;
    if (updateData.imageUrl) dbUpdateData.image_url = updateData.imageUrl;
    
    // Add other fields directly
    ['title', 'description', 'location', 'price', 'requirements'].forEach(field => {
      if (updateData[field] !== undefined) {
        dbUpdateData[field] = updateData[field];
      }
    });

    // Verify ownership
    const { data: existingEvent } = await supabase
      .from('events')
      .select('clinician_id')
      .eq('event_id', id)
      .single();

    if (!existingEvent || existingEvent.clinician_id !== clinicianId) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    const { data: event, error } = await supabase
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
  } catch (error) {
    console.error('Event update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete event
router.delete('/:id', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const { id } = req.params;
    const clinicianId = req.user!.id;

    // Verify ownership
    const { data: existingEvent } = await supabase
      .from('events')
      .select('clinician_id')
      .eq('event_id', id)
      .single();

    if (!existingEvent || existingEvent.clinician_id !== clinicianId) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    // Check if there are any paid registrations
    const { data: paidRegistrations } = await supabase
      .from('event_registrations')
      .select('registration_id')
      .eq('event_id', id)
      .eq('payment_status', 'paid');

    if (paidRegistrations && paidRegistrations.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete event with paid registrations. Please process refunds first.' 
      });
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('event_id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Event deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register for event
router.post('/:id/register', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify user is an athlete
    if (req.user!.role !== 'athlete') {
      return res.status(403).json({ error: 'Only athletes can register for events' });
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event is full
    if (event.current_registrations >= event.max_athletes) {
      return res.status(400).json({ error: 'Event is full' });
    }

    // Check if user already registered
    const { data: existingRegistration } = await supabase
      .from('event_registrations')
      .select('registration_id')
      .eq('event_id', id)
      .eq('athlete_id', userId)
      .single();

    if (existingRegistration) {
      return res.status(400).json({ error: 'Already registered for this event' });
    }

    // For private events, check access
    if (event.is_private) {
      const { data: access } = await supabase
        .from('private_event_access')
        .select('access_id')
        .eq('event_id', id)
        .eq('athlete_id', userId)
        .single();

      if (!access) {
        return res.status(403).json({ error: 'Not authorized to register for this private event' });
      }
    }

    // Create registration record
    const paymentStatus = event.price > 0 ? 'pending' : 'paid';
    
    const { data: registration, error: regError } = await supabase
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
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unregister from event
router.delete('/:id/register', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get registration
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', id)
      .eq('athlete_id', userId)
      .single();

    if (regError || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Check if payment was made (might need refund)
    if (registration.payment_status === 'paid') {
      return res.status(400).json({ 
        error: 'Cannot unregister from paid event. Please contact support for refunds.' 
      });
    }

    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('registration_id', registration.registration_id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Successfully unregistered from event' });
  } catch (error) {
    console.error('Event unregistration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grant private event access
router.post('/:id/grant-access', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const { id } = req.params;
    const clinicianId = req.user!.id;
    const { athleteIds } = req.body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return res.status(400).json({ error: 'Athletic IDs array is required' });
    }

    // Verify event ownership
    const { data: event } = await supabase
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

    // Grant access to specified athletes
    const accessRecords = athleteIds.map((athleteId: string) => ({
      event_id: id,
      athlete_id: athleteId
    }));

    const { data, error } = await supabase
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
  } catch (error) {
    console.error('Grant access error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke private event access
router.delete('/:id/revoke-access/:athleteId', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const { id, athleteId } = req.params;
    const clinicianId = req.user!.id;

    // Verify event ownership
    const { data: event } = await supabase
      .from('events')
      .select('clinician_id')
      .eq('event_id', id)
      .single();

    if (!event || event.clinician_id !== clinicianId) {
      return res.status(403).json({ error: 'Not authorized to manage this event' });
    }

    const { error } = await supabase
      .from('private_event_access')
      .delete()
      .eq('event_id', id)
      .eq('athlete_id', athleteId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Access revoked successfully' });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event registrations (for clinicians)
router.get('/:id/registrations', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const { id } = req.params;
    const clinicianId = req.user!.id;

    // Verify event ownership
    const { data: event } = await supabase
      .from('events')
      .select('clinician_id')
      .eq('event_id', id)
      .single();

    if (!event || event.clinician_id !== clinicianId) {
      return res.status(403).json({ error: 'Not authorized to view registrations for this event' });
    }

    const { data: registrations, error } = await supabase
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
  } catch (error) {
    console.error('Registrations fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 
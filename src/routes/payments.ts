import express from 'express';
import { authenticateToken, requireAthleteRole, requireClinicianRole } from '../middleware/auth';
import { PaymentService } from '../services/paymentService';
import { supabase } from '../config/database';

const router = express.Router();
const paymentService = PaymentService.getInstance();

// Create payment intent for event registration
router.post('/create-intent', authenticateToken, requireAthleteRole, async (req, res) => {
  try {
    const { registrationId } = req.body;
    const athleteId = req.user!.id;

    if (!registrationId) {
      return res.status(400).json({ error: 'Registration ID is required' });
    }

    // Verify registration belongs to current user and requires payment
    const { data: registration, error } = await supabase
      .from('event_registrations')
      .select(`
        registration_id,
        athlete_id,
        payment_status,
        amount_paid,
        events!inner(price, title)
      `)
      .eq('registration_id', registrationId)
      .eq('athlete_id', athleteId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.payment_status === 'paid') {
      return res.status(400).json({ error: 'Registration already paid' });
    }

    if (!registration.events) {
      return res.status(400).json({ error: 'Event data not found' });
    }

    // Handle both object and array cases for events data
    const eventData = Array.isArray(registration.events) 
      ? registration.events[0] 
      : registration.events;
    
    const eventPrice = (eventData as any)?.price || 0;
    
    if (eventPrice <= 0) {
      return res.status(400).json({ error: 'This event is free, no payment required' });
    }

    // Create payment intent
    const paymentData = await paymentService.createEventPaymentIntent(
      registrationId,
      eventPrice
    );

    res.json({
      clientSecret: paymentData.clientSecret,
      paymentIntentId: paymentData.paymentIntentId,
      amount: eventPrice
    });
  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Confirm payment
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    await paymentService.confirmPayment(paymentIntentId);

    res.json({ 
      success: true, 
      message: 'Payment confirmed successfully' 
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Get payment status for registration
router.get('/status/:registrationId', authenticateToken, async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user!.id;

    // Verify user has access to this registration
    const { data: registration, error } = await supabase
      .from('event_registrations')
      .select('athlete_id, event_id, events!inner(clinician_id)')
      .eq('registration_id', registrationId)
      .single();

    if (error || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Check if user is the athlete or the clinician
    const eventData = Array.isArray(registration.events) 
      ? registration.events[0] 
      : registration.events;
    
    const hasAccess = registration.athlete_id === userId || 
                     (eventData as any)?.clinician_id === userId;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to view payment status' });
    }

    const paymentStatus = await paymentService.getPaymentStatus(registrationId);

    res.json(paymentStatus);
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Process refund (clinicians only)
router.post('/refund', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const { registrationId, reason } = req.body;
    const clinicianId = req.user!.id;

    if (!registrationId) {
      return res.status(400).json({ error: 'Registration ID is required' });
    }

    // Verify registration belongs to clinician's event
    const { data: registration, error } = await supabase
      .from('event_registrations')
      .select(`
        registration_id,
        payment_status,
        events!inner(clinician_id, title)
      `)
      .eq('registration_id', registrationId)
      .single();

    if (error || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const eventData = Array.isArray(registration.events) 
      ? registration.events[0] 
      : registration.events;
    
    if ((eventData as any)?.clinician_id !== clinicianId) {
      return res.status(403).json({ error: 'Not authorized to refund this registration' });
    }

    if (registration.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Registration is not paid or already refunded' });
    }

    // Process refund
    const refund = await paymentService.createRefund(registrationId, reason);

    res.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100, // Convert from cents
      status: refund.status
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Get payment history for user
router.get('/history', authenticateToken, requireAthleteRole, async (req, res) => {
  try {
    const userId = req.user!.id;

    const paymentHistory = await paymentService.getPaymentHistory(userId);

    res.json({ paymentHistory });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// Stripe webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    await paymentService.handleWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook handling failed' });
  }
});

// Get revenue analytics for clinicians
router.get('/analytics', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const clinicianId = req.user!.id;
    const { timeframe = '30' } = req.query; // days

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(timeframe as string));

    // Get revenue data
    const { data: revenues, error } = await supabase
      .from('event_registrations')
      .select(`
        amount_paid,
        registered_at,
        payment_status,
        events!inner(title, start_date, clinician_id)
      `)
      .eq('events.clinician_id', clinicianId)
      .eq('payment_status', 'paid')
      .gte('registered_at', daysAgo.toISOString())
      .order('registered_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Calculate analytics
    const totalRevenue = revenues?.reduce((sum, reg) => sum + (reg.amount_paid || 0), 0) || 0;
    const totalRegistrations = revenues?.length || 0;
    const averagePerRegistration = totalRegistrations > 0 ? totalRevenue / totalRegistrations : 0;

    // Group by event
    const eventRevenues = revenues?.reduce((acc: any, reg) => {
      const eventTitle = reg.events[0].title;
      if (!acc[eventTitle]) {
        acc[eventTitle] = {
          title: eventTitle,
          revenue: 0,
          registrations: 0,
          startDate: reg.events[0].start_date
        };
      }
      acc[eventTitle].revenue += reg.amount_paid || 0;
      acc[eventTitle].registrations += 1;
      return acc;
    }, {});

    res.json({
      summary: {
        totalRevenue,
        totalRegistrations,
        averagePerRegistration,
        timeframeDays: parseInt(timeframe as string)
      },
      eventBreakdown: Object.values(eventRevenues || {}),
      recentTransactions: revenues?.slice(0, 10) || []
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics data' });
  }
});

// Get pending payments for clinician's events
router.get('/pending', authenticateToken, requireClinicianRole, async (req, res) => {
  try {
    const clinicianId = req.user!.id;

    const { data: pendingPayments, error } = await supabase
      .from('event_registrations')
      .select(`
        registration_id,
        registered_at,
        payment_status,
        events!inner(title, price, start_date, clinician_id),
        users!inner(first_name, last_name, email)
      `)
      .eq('events.clinician_id', clinicianId)
      .eq('payment_status', 'pending')
      .order('registered_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ pendingPayments });
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Failed to get pending payments' });
  }
});

export default router; 
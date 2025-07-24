import Stripe from 'stripe';
import { supabase, supabaseAdmin } from '../config/database';
import { EmailService } from './emailService';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const emailService = EmailService.getInstance();

export class PaymentService {
  private static instance: PaymentService;

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  // Create payment intent for event registration
  public async createEventPaymentIntent(
    registrationId: string,
    amount: number,
    currency: string = 'usd'
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      // Get registration details - Simplified query without complex joins
      const { data: registration, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          events!inner(title, start_date, location)
        `)
        .eq('registration_id', registrationId)
        .single();

      if (regError) {
        throw new Error('Registration not found');
      }

      if (!registration) {
        throw new Error('Registration not found');
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          registration_id: registrationId,
          event_id: registration.event_id,
          athlete_id: registration.athlete_id,
          event_title: registration.events.title,
        },
        description: `Registration for ${registration.events.title}`,
        // receipt_email will be handled by Stripe Elements form
      });

      // Update registration with payment intent ID
      await supabase
        .from('event_registrations')
        .update({ payment_intent_id: paymentIntent.id })
        .eq('registration_id', registrationId);

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error('Create payment intent error:', error);
      throw error;
    }
  }

  // Confirm payment and update registration status
  public async confirmPayment(paymentIntentId: string): Promise<void> {
    console.log('🔄 CONFIRM PAYMENT STARTED - PaymentIntentId:', paymentIntentId);
    
    try {
      // Get payment intent from Stripe
      console.log('🔍 Retrieving payment intent from Stripe...');
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log('✅ Payment intent retrieved:', paymentIntent.status);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not successful');
      }

      const registrationId = paymentIntent.metadata.registration_id;
      console.log('📋 Registration ID from metadata:', registrationId);

      // Update registration status
      console.log('💾 Updating registration status...');
      const { data: registration, error } = await supabase
        .from('event_registrations')
        .update({
          payment_status: 'paid',
          amount_paid: paymentIntent.amount / 100 // Convert back from cents
        })
        .eq('registration_id', registrationId)
        .select(`
          *,
          events!inner(title, start_date, end_date, location, clinician_id,
            clinician_profiles!left(
              users!inner(first_name, last_name)
            )
          )
        `)
        .single();

      console.log('📊 Registration update result:', { error, registration });

      if (error) {
        console.error('❌ Failed to update registration status:', error);
        throw new Error('Failed to update registration status');
      }

      // Send confirmation email
      console.log('📧 Preparing to send confirmation email...');
      if (registration) {
        console.log('✅ Registration data found, proceeding with email...');
        // Get athlete email from Supabase auth system
        console.log('👤 Fetching athlete email for user_id:', registration.athlete_id);
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(registration.athlete_id);

        console.log('📧 Auth user query result:', { authError, email: authUser.user?.email });

        if (!authError && authUser.user?.email) {
          const athleteEmail = authUser.user.email;
          const eventTitle = registration.events.title;
          
          // Get clinician name with fallback logic
          let clinicianName = 'Unknown Instructor';
          if (registration.events.clinician_profiles?.users?.[0]) {
            const user = registration.events.clinician_profiles.users[0];
            clinicianName = `${user.first_name} ${user.last_name}`;
          } else {
            // Fallback: get clinician info directly from users table
            const { data: clinicianUser, error: clinicianError } = await supabase
              .from('users')
              .select('first_name, last_name')
              .eq('user_id', registration.events.clinician_id)
              .single();
            
            if (!clinicianError && clinicianUser) {
              clinicianName = `${clinicianUser.first_name} ${clinicianUser.last_name}`;
            }
          }
          
          const eventDetails = `
            <h3>Event Details:</h3>
            <p><strong>Event:</strong> ${registration.events.title}</p>
            <p><strong>Instructor:</strong> ${clinicianName}</p>
            <p><strong>Date:</strong> ${new Date(registration.events.start_date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(registration.events.start_date).toLocaleTimeString()} - ${new Date(registration.events.end_date).toLocaleTimeString()}</p>
            <p><strong>Location:</strong> ${registration.events.location}</p>
            <p><strong>Amount Paid:</strong> $${registration.amount_paid}</p>
          `;

          const eventLink = `${process.env.CORS_ORIGIN}/events/${registration.event_id}`;

          console.log('📧 Sending event registration confirmation email...');
          console.log('To:', athleteEmail);
          console.log('Event:', eventTitle);
          console.log('Instructor:', clinicianName);

          try {
            console.log('🚀 Calling email service...');
            const emailResult = await emailService.sendEventRegistrationConfirmation(
              athleteEmail,
              eventTitle,
              eventDetails,
              eventLink
            );
            console.log('✅ Event registration confirmation email sent successfully, result:', emailResult);
          } catch (emailError) {
            console.error('❌ Failed to send event registration confirmation email:', emailError);
            // Don't throw error - payment was successful even if email failed
          }
        } else {
          console.log('❌ No athlete data found or error occurred');
        }
      } else {
        console.log('❌ No registration data found');
      }
    } catch (error) {
      console.error('💥 CONFIRM PAYMENT ERROR:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  // Create refund for event registration
  public async createRefund(
    registrationId: string,
    reason: string = 'requested_by_customer'
  ): Promise<Stripe.Refund> {
    try {
      // Get registration with payment intent
      const { data: registration, error: regError } = await supabase
        .from('event_registrations')
        .select('payment_intent_id, amount_paid')
        .eq('registration_id', registrationId)
        .eq('payment_status', 'paid')
        .single();

      if (regError || !registration || !registration.payment_intent_id) {
        throw new Error('Paid registration not found');
      }

      // Create refund in Stripe
      const refund = await stripe.refunds.create({
        payment_intent: registration.payment_intent_id,
        reason: reason as any,
        metadata: {
          registration_id: registrationId
        }
      });

      // Update registration status
      await supabase
        .from('event_registrations')
        .update({ payment_status: 'refunded' })
        .eq('registration_id', registrationId);

      return refund;
    } catch (error) {
      console.error('Create refund error:', error);
      throw error;
    }
  }

  // Handle Stripe webhooks
  public async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<void> {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'refund.created':
          await this.handleRefundCreated(event.data.object as Stripe.Refund);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const registrationId = paymentIntent.metadata.registration_id;

      if (!registrationId) {
        console.error('No registration ID in payment intent metadata');
        return;
      }

      await this.confirmPayment(paymentIntent.id);
      console.log(`Payment succeeded for registration: ${registrationId}`);
    } catch (error) {
      console.error('Handle payment succeeded error:', error);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const registrationId = paymentIntent.metadata.registration_id;

      if (!registrationId) {
        console.error('No registration ID in payment intent metadata');
        return;
      }

      // Update registration status to failed
      await supabase
        .from('event_registrations')
        .update({ payment_status: 'failed' })
        .eq('registration_id', registrationId);

      console.log(`Payment failed for registration: ${registrationId}`);
    } catch (error) {
      console.error('Handle payment failed error:', error);
    }
  }

  private async handleRefundCreated(refund: Stripe.Refund): Promise<void> {
    try {
      const registrationId = refund.metadata?.registration_id;

      if (!registrationId) {
        console.error('No registration ID in refund metadata');
        return;
      }

      // Registration status should already be updated when refund was created
      console.log(`Refund processed for registration: ${registrationId}`);
    } catch (error) {
      console.error('Handle refund created error:', error);
    }
  }

  // Get payment status for registration
  public async getPaymentStatus(registrationId: string): Promise<{
    status: string;
    paymentIntentId?: string;
    amountPaid?: number;
  }> {
    try {
      const { data: registration, error } = await supabase
        .from('event_registrations')
        .select('payment_status, payment_intent_id, amount_paid')
        .eq('registration_id', registrationId)
        .single();

      if (error || !registration) {
        throw new Error('Registration not found');
      }

      return {
        status: registration.payment_status,
        paymentIntentId: registration.payment_intent_id,
        amountPaid: registration.amount_paid
      };
    } catch (error) {
      console.error('Get payment status error:', error);
      throw error;
    }
  }

  // Get Stripe customer for user (create if doesn't exist)
  public async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
    try {
      // Get user details
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('user_id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Check if customer already exists in Stripe
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1
      });

      if (customers.data.length > 0) {
        return customers.data[0];
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        metadata: {
          user_id: userId
        }
      });

      return customer;
    } catch (error) {
      console.error('Get or create customer error:', error);
      throw error;
    }
  }

  // Get payment history for user
  public async getPaymentHistory(userId: string): Promise<any[]> {
    try {
      const { data: registrations, error } = await supabase
        .from('event_registrations')
        .select(`
          registration_id,
          payment_status,
          amount_paid,
          registered_at,
          payment_intent_id,
          events!inner(title, start_date, location)
        `)
        .eq('athlete_id', userId)
        .in('payment_status', ['paid', 'refunded'])
        .order('registered_at', { ascending: false });

      if (error) {
        throw new Error('Failed to fetch payment history');
      }

      return registrations || [];
    } catch (error) {
      console.error('Get payment history error:', error);
      throw error;
    }
  }
} 
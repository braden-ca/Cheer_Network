"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const database_1 = require("../config/database");
const emailService_1 = require("./emailService");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env' });
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});
const emailService = emailService_1.EmailService.getInstance();
class PaymentService {
    static getInstance() {
        if (!PaymentService.instance) {
            PaymentService.instance = new PaymentService();
        }
        return PaymentService.instance;
    }
    async createEventPaymentIntent(registrationId, amount, currency = 'usd') {
        try {
            const { data: registration, error: regError } = await database_1.supabase
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
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency,
                metadata: {
                    registration_id: registrationId,
                    event_id: registration.event_id,
                    athlete_id: registration.athlete_id,
                    event_title: registration.events.title,
                },
                description: `Registration for ${registration.events.title}`,
            });
            await database_1.supabase
                .from('event_registrations')
                .update({ payment_intent_id: paymentIntent.id })
                .eq('registration_id', registrationId);
            return {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            };
        }
        catch (error) {
            console.error('Create payment intent error:', error);
            throw error;
        }
    }
    async confirmPayment(paymentIntentId) {
        console.log('🔄 CONFIRM PAYMENT STARTED - PaymentIntentId:', paymentIntentId);
        try {
            console.log('🔍 Retrieving payment intent from Stripe...');
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            console.log('✅ Payment intent retrieved:', paymentIntent.status);
            if (paymentIntent.status !== 'succeeded') {
                throw new Error('Payment not successful');
            }
            const registrationId = paymentIntent.metadata.registration_id;
            console.log('📋 Registration ID from metadata:', registrationId);
            console.log('💾 Updating registration status...');
            const { data: registration, error } = await database_1.supabase
                .from('event_registrations')
                .update({
                payment_status: 'paid',
                amount_paid: paymentIntent.amount / 100
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
            console.log('📧 Preparing to send confirmation email...');
            if (registration) {
                console.log('✅ Registration data found, proceeding with email...');
                console.log('👤 Fetching athlete email for user_id:', registration.athlete_id);
                const { data: authUser, error: authError } = await database_1.supabaseAdmin.auth.admin.getUserById(registration.athlete_id);
                console.log('📧 Auth user query result:', { authError, email: authUser.user?.email });
                if (!authError && authUser.user?.email) {
                    const athleteEmail = authUser.user.email;
                    const eventTitle = registration.events.title;
                    let clinicianName = 'Unknown Instructor';
                    if (registration.events.clinician_profiles?.users?.[0]) {
                        const user = registration.events.clinician_profiles.users[0];
                        clinicianName = `${user.first_name} ${user.last_name}`;
                    }
                    else {
                        const { data: clinicianUser, error: clinicianError } = await database_1.supabase
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
                        const emailResult = await emailService.sendEventRegistrationConfirmation(athleteEmail, eventTitle, eventDetails, eventLink);
                        console.log('✅ Event registration confirmation email sent successfully, result:', emailResult);
                    }
                    catch (emailError) {
                        console.error('❌ Failed to send event registration confirmation email:', emailError);
                    }
                }
                else {
                    console.log('❌ No athlete data found or error occurred');
                }
            }
            else {
                console.log('❌ No registration data found');
            }
        }
        catch (error) {
            console.error('💥 CONFIRM PAYMENT ERROR:', error);
            console.error('Error type:', typeof error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            throw error;
        }
    }
    async createRefund(registrationId, reason = 'requested_by_customer') {
        try {
            const { data: registration, error: regError } = await database_1.supabase
                .from('event_registrations')
                .select('payment_intent_id, amount_paid')
                .eq('registration_id', registrationId)
                .eq('payment_status', 'paid')
                .single();
            if (regError || !registration || !registration.payment_intent_id) {
                throw new Error('Paid registration not found');
            }
            const refund = await stripe.refunds.create({
                payment_intent: registration.payment_intent_id,
                reason: reason,
                metadata: {
                    registration_id: registrationId
                }
            });
            await database_1.supabase
                .from('event_registrations')
                .update({ payment_status: 'refunded' })
                .eq('registration_id', registrationId);
            return refund;
        }
        catch (error) {
            console.error('Create refund error:', error);
            throw error;
        }
    }
    async handleWebhook(payload, signature) {
        try {
            const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                case 'refund.created':
                    await this.handleRefundCreated(event.data.object);
                    break;
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
        }
        catch (error) {
            console.error('Webhook handling error:', error);
            throw error;
        }
    }
    async handlePaymentSucceeded(paymentIntent) {
        try {
            const registrationId = paymentIntent.metadata.registration_id;
            if (!registrationId) {
                console.error('No registration ID in payment intent metadata');
                return;
            }
            await this.confirmPayment(paymentIntent.id);
            console.log(`Payment succeeded for registration: ${registrationId}`);
        }
        catch (error) {
            console.error('Handle payment succeeded error:', error);
        }
    }
    async handlePaymentFailed(paymentIntent) {
        try {
            const registrationId = paymentIntent.metadata.registration_id;
            if (!registrationId) {
                console.error('No registration ID in payment intent metadata');
                return;
            }
            await database_1.supabase
                .from('event_registrations')
                .update({ payment_status: 'failed' })
                .eq('registration_id', registrationId);
            console.log(`Payment failed for registration: ${registrationId}`);
        }
        catch (error) {
            console.error('Handle payment failed error:', error);
        }
    }
    async handleRefundCreated(refund) {
        try {
            const registrationId = refund.metadata?.registration_id;
            if (!registrationId) {
                console.error('No registration ID in refund metadata');
                return;
            }
            console.log(`Refund processed for registration: ${registrationId}`);
        }
        catch (error) {
            console.error('Handle refund created error:', error);
        }
    }
    async getPaymentStatus(registrationId) {
        try {
            const { data: registration, error } = await database_1.supabase
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
        }
        catch (error) {
            console.error('Get payment status error:', error);
            throw error;
        }
    }
    async getOrCreateCustomer(userId) {
        try {
            const { data: user, error: userError } = await database_1.supabase
                .from('users')
                .select('first_name, last_name, email')
                .eq('user_id', userId)
                .single();
            if (userError || !user) {
                throw new Error('User not found');
            }
            const customers = await stripe.customers.list({
                email: user.email,
                limit: 1
            });
            if (customers.data.length > 0) {
                return customers.data[0];
            }
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                metadata: {
                    user_id: userId
                }
            });
            return customer;
        }
        catch (error) {
            console.error('Get or create customer error:', error);
            throw error;
        }
    }
    async getPaymentHistory(userId) {
        try {
            const { data: registrations, error } = await database_1.supabase
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
        }
        catch (error) {
            console.error('Get payment history error:', error);
            throw error;
        }
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=paymentService.js.map
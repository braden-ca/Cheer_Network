# Cheer Network Setup Guide

## Overview
Your Cheer Network application is now fully configured with a comprehensive backend API! This guide will help you get everything running.

## ✅ What's Been Implemented

### Backend Features
- **Authentication System**: Complete with email verification, password reset
- **User Management**: Athlete and clinician profiles with role-based access
- **Event System**: Create, manage, and register for public/private events
- **Follow System**: Athletes can follow clinicians with approval workflow
- **Real-time Messaging**: Socket.io integration for instant messaging
- **Payment Processing**: Stripe integration with webhooks and refunds
- **Email Service**: Resend integration for all email notifications

### Database
- Complete PostgreSQL schema with 11 tables
- Row Level Security (RLS) policies
- Database triggers for automated updates
- Performance indexes

## 🔧 Environment Setup

Create a `.env` file in your project root with these variables:

```env
# Port Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Resend Email Configuration
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# JWT Configuration (optional)
JWT_SECRET=your_jwt_secret_key_here
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
The database setup script is located at `src/scripts/setup-database.ts`. Run it to create all tables and policies:

```bash
npm run db:setup
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm start
```

## 📋 Service Setup Instructions

### Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your URL and keys
3. Enable Authentication in the dashboard
4. Configure email templates for auth emails

### Stripe Setup
1. Create account at [stripe.com](https://stripe.com)
2. Get your API keys from the dashboard
3. Set up webhooks endpoint: `https://yourdomain.com/api/payments/webhook`
4. Add these webhook events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.dispute.created`

### Resend Setup
1. Create account at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Verify your domain for sending emails
4. Configure your FROM_EMAIL address

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/search` - Search users
- `GET /api/users/dashboard` - Get dashboard data

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event (clinicians only)
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event (clinicians only)
- `DELETE /api/events/:id` - Delete event (clinicians only)
- `POST /api/events/:id/register` - Register for event

### Follows
- `POST /api/follows/request` - Send follow request
- `PUT /api/follows/:id/respond` - Accept/reject follow request
- `GET /api/follows/requests` - Get follow requests
- `GET /api/follows/followers` - Get followers
- `GET /api/follows/following` - Get following

### Messages
- `GET /api/messages/conversations` - Get conversations
- `GET /api/messages/:userId` - Get messages with user
- `POST /api/messages` - Send message
- `PUT /api/messages/:id/read` - Mark message as read

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `POST /api/payments/refund` - Process refund
- `GET /api/payments/history` - Get payment history
- `GET /api/payments/analytics` - Get revenue analytics

## 🔧 Frontend Integration

The backend is ready for frontend integration. Key considerations:

### Authentication Flow
1. Use Supabase Auth for user authentication
2. Store JWT tokens securely
3. Include tokens in API requests via Authorization header

### Real-time Features
Connect to Socket.io for real-time messaging:
```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:3000');
```

### Payment Integration
Use Stripe Elements for secure payment processing:
```javascript
import { loadStripe } from '@stripe/stripe-js';
const stripe = await loadStripe('your_publishable_key');
```

## 🐛 Troubleshooting

### Database Connection Issues
- Verify Supabase environment variables
- Check database URL and credentials
- Ensure RLS policies are properly configured

### Payment Issues
- Verify Stripe webhook endpoint is accessible
- Check webhook secret matches your configuration
- Test with Stripe's test cards

### Email Issues
- Verify Resend API key
- Check domain verification status
- Ensure FROM_EMAIL is verified

## 📁 Project Structure

```
src/
├── config/
│   └── database.ts          # Database configuration
├── middleware/
│   ├── auth.ts             # Authentication middleware
│   └── validation.ts       # Request validation
├── routes/
│   ├── auth.ts            # Authentication routes
│   ├── users.ts           # User management routes
│   ├── events.ts          # Event management routes
│   ├── follows.ts         # Follow system routes
│   ├── messages.ts        # Messaging routes
│   └── payments.ts        # Payment processing routes
├── services/
│   ├── emailService.ts    # Email service with templates
│   └── paymentService.ts  # Stripe payment integration
├── scripts/
│   └── setup-database.ts  # Database setup script
└── server.ts              # Main server file
```

## 🎯 Next Steps

1. **Set up your environment variables** with actual service credentials
2. **Run the database setup** to create all necessary tables
3. **Test the API endpoints** using Postman or similar tool
4. **Set up webhook endpoints** for Stripe and email services
5. **Build your frontend** to consume the API
6. **Deploy to production** when ready

Your Cheer Network backend is production-ready with comprehensive features, security, and scalability! 
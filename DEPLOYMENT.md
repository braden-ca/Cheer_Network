# 🚀 Vercel Deployment Guide

## Overview
This guide will help you deploy your Cheer Network Express.js application to Vercel.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be on GitHub (✅ Already done!)
3. **Environment Variables**: You'll need to configure these in Vercel

## 🔧 Step-by-Step Deployment

### 1. **Connect to Vercel**

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository: `braden-ca/Cheer_Network`
4. Vercel will automatically detect it's a Node.js project

### 2. **Configure Build Settings**

Vercel will automatically detect these settings from your `package.json`:
- **Framework Preset**: Node.js
- **Build Command**: `npm run build` (✅ Already set)
- **Output Directory**: `dist` (✅ Already set)
- **Install Command**: `npm install`

### 3. **Environment Variables**

In your Vercel project dashboard, go to **Settings > Environment Variables** and add:

```env
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

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# CORS Configuration (Update for production)
CORS_ORIGIN=https://your-vercel-domain.vercel.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

### 4. **Deploy**

1. Click **Deploy**
2. Vercel will build and deploy your application
3. You'll get a URL like: `https://cheer-network-abc123.vercel.app`

## 🔄 **Post-Deployment Setup**

### 1. **Update Stripe Webhooks**
Go to your Stripe dashboard and update webhook endpoints:
- **URL**: `https://your-vercel-domain.vercel.app/api/payments/webhook`
- **Events**: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 2. **Update Supabase Settings**
In your Supabase project:
- Update CORS origins to include your Vercel domain
- Verify email templates work with your domain

### 3. **Test Your Application**
- Test user registration/login
- Test payment processing
- Test messaging functionality
- Test file uploads

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compilation works locally

2. **Environment Variables**
   - Double-check all environment variables are set in Vercel
   - Ensure no typos in variable names

3. **API Routes Not Working**
   - Check that `vercel.json` is properly configured
   - Verify routes are in the `dist/` folder after build

4. **File Uploads**
   - Vercel has limitations on file uploads
   - Consider using Supabase Storage or AWS S3 for production

## 📈 **Production Considerations**

### **Performance:**
- Vercel automatically scales your application
- Cold starts may occur (first request after inactivity)
- Consider using Vercel Pro for better performance

### **File Storage:**
- Vercel's file system is read-only in production
- Use Supabase Storage for user uploads
- Update your upload logic accordingly

### **Database:**
- Ensure your Supabase project is on a paid plan for production
- Set up proper RLS policies
- Monitor database performance

## 🔗 **Useful Links**

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)

## 🎉 **Success!**

Once deployed, your Cheer Network will be live at your Vercel URL and accessible to users worldwide! 
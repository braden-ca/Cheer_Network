"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const resend_1 = require("resend");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env' });
console.log('🔍 EMAIL SERVICE DEBUG - Environment Variables:');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? `[SET - ${process.env.RESEND_API_KEY.substring(0, 10)}...]` : '[NOT SET]');
console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || '[NOT SET]');
console.log('FROM_EMAIL (fallback):', process.env.FROM_EMAIL || '[NOT SET]');
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'onboarding@resend.dev';
console.log('📧 Final email configuration:');
console.log('API Key:', resendApiKey ? `[SET - ${resendApiKey.substring(0, 10)}...]` : '[NOT SET]');
console.log('From Email:', fromEmail);
if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY is missing from environment variables!');
}
const resend = new resend_1.Resend(resendApiKey);
class EmailService {
    static getInstance() {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
            console.log('✅ EmailService instance created');
        }
        return EmailService.instance;
    }
    async sendEmail({ to, subject, html }) {
        console.log('📤 ATTEMPTING TO SEND EMAIL:');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('From:', fromEmail);
        console.log('HTML length:', html.length, 'characters');
        try {
            console.log('🔌 Testing Resend connection...');
            const startTime = Date.now();
            const { data, error } = await resend.emails.send({
                from: fromEmail,
                to,
                subject,
                html,
            });
            const endTime = Date.now();
            console.log('⏱️ Email API call took:', endTime - startTime, 'ms');
            if (error) {
                console.error('❌ RESEND API ERROR:');
                console.error('Error object:', JSON.stringify(error, null, 2));
                console.error('Error message:', error.message || 'No message');
                console.error('Error name:', error.name || 'No name');
                if (error.name?.includes('api_key') || error.message?.includes('api key')) {
                    console.error('🔑 API key issue detected. Check your RESEND_API_KEY');
                }
                if (error.name?.includes('validation') || error.message?.includes('validation')) {
                    console.error('🔍 Validation error - check email addresses and content');
                }
                return false;
            }
            console.log('✅ EMAIL SENT SUCCESSFULLY:');
            console.log('Email ID:', data?.id);
            console.log('Response data:', JSON.stringify(data, null, 2));
            return true;
        }
        catch (error) {
            console.error('💥 EMAIL SERVICE EXCEPTION:');
            console.error('Error type:', typeof error);
            console.error('Error message:', error.message || 'No message');
            console.error('Error stack:', error.stack || 'No stack');
            console.error('Full error object:', JSON.stringify(error, null, 2));
            if (error.code === 'ENOTFOUND') {
                console.error('🌐 DNS resolution failed - check internet connection');
            }
            if (error.code === 'ECONNREFUSED') {
                console.error('🚫 Connection refused - check network/firewall');
            }
            if (error.code === 'ETIMEDOUT') {
                console.error('⏰ Request timed out - check network speed');
            }
            return false;
        }
    }
    async sendVerificationEmail(email, verificationLink) {
        console.log('🔐 SENDING VERIFICATION EMAIL:');
        console.log('Target email:', email);
        console.log('Verification link:', verificationLink);
        const subject = 'Verify Your Cheer Network Account';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Cheer Network!</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for joining the Cheer Network community! To complete your registration and start connecting with athletes and clinicians, please verify your email address.</p>
            <p>Click the button below to verify your account:</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationLink}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with Cheer Network, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Cheer Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        const result = await this.sendEmail({ to: email, subject, html });
        console.log('🔐 Verification email result:', result ? 'SUCCESS' : 'FAILED');
        return result;
    }
    async sendPasswordResetEmail(email, resetLink) {
        const subject = 'Reset Your Cheer Network Password';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password for your Cheer Network account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>© 2024 Cheer Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to: email, subject, html });
    }
    async sendFollowRequestNotification(clinicianEmail, athleteName, dashboardLink) {
        const subject = 'New Follow Request - Cheer Network';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Follow Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Follow Request</h1>
          </div>
          <div class="content">
            <h2>You have a new follow request!</h2>
            <p><strong>${athleteName}</strong> wants to follow you on Cheer Network.</p>
            <p>Review their profile and accept or decline the request from your dashboard.</p>
            <p style="text-align: center;">
              <a href="${dashboardLink}" class="button">View Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 Cheer Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to: clinicianEmail, subject, html });
    }
    async sendEventRegistrationConfirmation(athleteEmail, eventTitle, eventDetails, eventLink) {
        console.log('📧 EVENT REGISTRATION CONFIRMATION EMAIL CALLED');
        console.log('To:', athleteEmail);
        console.log('Event:', eventTitle);
        console.log('Details:', eventDetails);
        console.log('Link:', eventLink);
        const subject = `Registration Confirmed: ${eventTitle}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Registration Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .event-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Registration Confirmed!</h1>
          </div>
          <div class="content">
            <h2>You're all set for ${eventTitle}</h2>
            <p>Your registration has been confirmed and payment processed successfully.</p>
            <div class="event-details">
              ${eventDetails}
            </div>
            <p>You can view full event details and connect with other participants:</p>
            <p style="text-align: center;">
              <a href="${eventLink}" class="button">View Event Details</a>
            </p>
            <p>We're excited to see you there!</p>
          </div>
          <div class="footer">
            <p>© 2024 Cheer Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        console.log('📤 Calling sendEmail method...');
        const result = await this.sendEmail({ to: athleteEmail, subject, html });
        console.log('📧 Event registration confirmation email result:', result);
        return result;
    }
    async sendNewMessageNotification(recipientEmail, senderName, messagePreview, messagesLink) {
        const subject = `New message from ${senderName}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Message</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .message-preview { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; font-style: italic; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Message</h1>
          </div>
          <div class="content">
            <h2>Message from ${senderName}</h2>
            <div class="message-preview">
              "${messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview}"
            </div>
            <p style="text-align: center;">
              <a href="${messagesLink}" class="button">View Message</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 Cheer Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to: recipientEmail, subject, html });
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=emailService.js.map
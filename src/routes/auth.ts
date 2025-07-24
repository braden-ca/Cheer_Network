import express from 'express';
import { supabase, supabaseAdmin } from '../config/database';
import { EmailService } from '../services/emailService';
import { authenticateToken } from '../middleware/auth';
import { 
  validateRequest, 
  registerSchema, 
  clinicianRegisterSchema,
  loginSchema, 
  passwordResetSchema,
  passwordUpdateSchema,
  updateProfileSchema 
} from '../middleware/validation';

const router = express.Router();
const emailService = EmailService.getInstance();

// Register new user
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  console.log('🚀 REGISTRATION STARTED');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { email, password, firstName, lastName, role } = req.body;

    console.log('📝 Registration details:');
    console.log('Email:', email);
    console.log('Name:', firstName, lastName);
    console.log('Role:', role);
    console.log('Password length:', password ? password.length : 0);

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('user_id')
      .eq('user_id', '')
      .single();

    console.log('Existing user check result:', existingUser);

    // Register user with Supabase Auth - disable auto email, use Resend instead
    console.log('🔐 Creating user with Supabase Auth...');
    console.log('Using email_confirm: false, will send custom verification via Resend');
    
    const authStartTime = Date.now();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Disable Supabase auto-email, use custom Resend
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role
      }
    });
    const authEndTime = Date.now();

    console.log('⏱️ Supabase Auth call took:', authEndTime - authStartTime, 'ms');

    if (authError) {
      console.error('❌ SUPABASE AUTH ERROR:');
      console.error('Error message:', authError.message);
      console.error('Error details:', JSON.stringify(authError, null, 2));
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      console.error('❌ No user data returned from Supabase Auth');
      return res.status(400).json({ error: 'Failed to create user' });
    }

    console.log('✅ Supabase Auth user created:');
    console.log('User ID:', authData.user.id);
    console.log('Email:', authData.user.email);
    console.log('Email confirmed:', authData.user.email_confirmed_at ? 'YES' : 'NO');
    console.log('Created at:', authData.user.created_at);

    // Create user profile
    console.log('👤 Creating user profile...');
    const profileStartTime = Date.now();
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        user_id: authData.user.id,
        role,
        first_name: firstName,
        last_name: lastName,
        email_verified: false
      });
    const profileEndTime = Date.now();

    console.log('⏱️ Profile creation took:', profileEndTime - profileStartTime, 'ms');

    if (profileError) {
      console.error('❌ PROFILE CREATION ERROR:');
      console.error('Error details:', JSON.stringify(profileError, null, 2));
      // Clean up auth user if profile creation fails
      console.log('🧹 Cleaning up auth user due to profile creation failure...');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: 'Failed to create user profile' });
    }

    console.log('✅ User profile created successfully');

    // Create role-specific profile
    console.log('🎭 Creating role-specific profile for:', role);
    if (role === 'clinician') {
      const clinicianStartTime = Date.now();
      const { error: clinicianError } = await supabaseAdmin
        .from('clinician_profiles')
        .insert({
          clinician_id: authData.user.id,
          specialties: [],
          years_experience: 0,
          certifications: [],
          verified: false,
          rating: 0,
          total_reviews: 0
        });
      const clinicianEndTime = Date.now();

      console.log('⏱️ Clinician profile creation took:', clinicianEndTime - clinicianStartTime, 'ms');

      if (clinicianError) {
        console.error('❌ Error creating clinician profile:', clinicianError);
      } else {
        console.log('✅ Clinician profile created successfully');
      }
    } else if (role === 'athlete') {
      const athleteStartTime = Date.now();
      const { error: athleteError } = await supabaseAdmin
        .from('athlete_profiles')
        .insert({
          athlete_id: authData.user.id,
          skill_level: 'beginner'
        });
      const athleteEndTime = Date.now();

      console.log('⏱️ Athlete profile creation took:', athleteEndTime - athleteStartTime, 'ms');

      if (athleteError) {
        console.error('❌ Error creating athlete profile:', athleteError);
      } else {
        console.log('✅ Athlete profile created successfully');
      }
    }

    // Send custom verification email via Resend
    console.log('📧 EMAIL VERIFICATION STRATEGY:');
    console.log('✅ Using Resend for custom branded verification emails');
    
    try {
      // Generate email verification token (we'll use the user ID as simple token for now)
      const verificationToken = authData.user.id;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}&type=signup`;
      
      console.log('🔗 Verification link generated:', verificationLink);
      
      console.log('🔄 Sending verification email via Resend...');
      const emailResult = await emailService.sendVerificationEmail(email, verificationLink);
      
      if (emailResult) {
        console.log('✅ Verification email sent successfully via Resend');
      } else {
        console.error('❌ Failed to send verification email via Resend');
        // Don't fail registration if email fails
      }
    } catch (emailError) {
      console.error('📧 Resend verification email error:', emailError);
      // Don't fail registration if email fails
    }

    console.log('🎉 REGISTRATION COMPLETED SUCCESSFULLY');
    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      userId: authData.user.id
    });

  } catch (error) {
    console.error('💥 REGISTRATION EXCEPTION:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Full error object:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced clinician registration with profile fields
router.post('/register-clinician', (req, res, next) => {
  console.log('🚀 ENHANCED CLINICIAN REGISTRATION STARTED');
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', req.headers);
  
  // Validate manually to get better error info
  const { error, value } = clinicianRegisterSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    console.error('❌ VALIDATION FAILED:');
    console.error('Error details:', error.details);
    error.details.forEach((detail, index) => {
      console.error(`  ${index + 1}. Field: ${detail.path.join('.')}`);
      console.error(`     Message: ${detail.message}`);
      console.error(`     Value: ${JSON.stringify(detail.context?.value)}`);
    });
    
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    });
  }
  
  req.body = value;
  next();
}, async (req, res) => {
  console.log('✅ Validation passed, proceeding with registration...');
  console.log('Validated body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role,
      yearsExperience,
      specialties,
      city,
      state,
      currentSchool,
      profileImageUrl,
      bio
    } = req.body;

    console.log('📝 Enhanced clinician registration details:');
    console.log('Email:', email);
    console.log('Name:', firstName, lastName);
    console.log('Years Experience:', yearsExperience);
    console.log('Specialties:', specialties);
    console.log('Location:', city, state);
    console.log('School:', currentSchool || 'Not provided');

    // Register user with Supabase Auth
    console.log('🔐 Creating user with Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role
      }
    });

    if (authError) {
      console.error('❌ SUPABASE AUTH ERROR:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    console.log('✅ Supabase Auth user created:', authData.user.id);

    // Create user profile with bio and profile image
    console.log('👤 Creating user profile...');
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        user_id: authData.user.id,
        role,
        first_name: firstName,
        last_name: lastName,
        bio: bio || null,
        profile_image_url: profileImageUrl || null,
        email_verified: false
      });

    if (profileError) {
      console.error('❌ PROFILE CREATION ERROR:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: 'Failed to create user profile' });
    }

    console.log('✅ User profile created successfully');

    // Create enhanced clinician profile
    console.log('🎭 Creating enhanced clinician profile...');
    
    // Build profile data based on what columns exist
    const profileData = {
      clinician_id: authData.user.id,
      specialties,
      years_experience: yearsExperience,
      certifications: [],
      verified: false,
      rating: 0,
      total_reviews: 0
    };

    // Try to add optional fields if they exist in the table
    try {
      // Test if enhanced columns exist by attempting to insert with them
      const { error: clinicianError } = await supabaseAdmin
        .from('clinician_profiles')
        .insert({
          ...profileData,
          city,
          state,
          current_school: currentSchool || null
        });

      if (clinicianError) {
        // If error mentions missing columns or schema cache, try basic insert without enhanced fields
        if (clinicianError.message.includes('column') || 
            clinicianError.message.includes('schema cache') ||
            clinicianError.code === 'PGRST204') {
          console.log('⚠️ Enhanced fields not available, creating basic clinician profile...');
          const { error: basicError } = await supabaseAdmin
            .from('clinician_profiles')
            .insert(profileData);
            
          if (basicError) {
            console.error('❌ Error creating basic clinician profile:', basicError);
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: 'Failed to create clinician profile' });
          } else {
            console.log('✅ Basic clinician profile created successfully');
          }
        } else {
          console.error('❌ Error creating enhanced clinician profile:', clinicianError);
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return res.status(400).json({ error: 'Failed to create clinician profile' });
        }
      } else {
        console.log('✅ Enhanced clinician profile created successfully');
      }
    } catch (error) {
      console.error('❌ Exception creating clinician profile:', error);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: 'Failed to create clinician profile' });
    }

    console.log('✅ Enhanced clinician profile created successfully');

    // Add specialties to lookup table if they don't exist (skip if table doesn't exist)
    console.log('📚 Attempting to add specialties to lookup table...');
    for (const specialty of specialties) {
      try {
        await supabaseAdmin
          .from('specialties_lookup')
          .insert({ name: specialty })
          .select()
          .single();
        console.log(`✅ Added specialty: ${specialty}`);
      } catch (error: any) {
        if (error?.code === '42P01') {
          console.log(`⚠️ specialties_lookup table doesn't exist, skipping specialty insertion`);
          break; // Don't try other specialties if table doesn't exist
        } else {
          console.log(`Specialty "${specialty}" already exists or failed to insert`);
        }
      }
    }

    // Add school to lookup table if provided and doesn't exist (skip if table doesn't exist)
    if (currentSchool) {
      console.log('🏫 Attempting to add school to lookup table...');
      try {
        await supabaseAdmin
          .from('schools_lookup')
          .insert({ 
            name: currentSchool,
            city,
            state
          })
          .select()
          .single();
        console.log(`✅ Added school: ${currentSchool}`);
      } catch (error: any) {
        if (error?.code === '42P01') {
          console.log(`⚠️ schools_lookup table doesn't exist, skipping school insertion`);
        } else {
          console.log(`School "${currentSchool}" already exists or failed to insert`);
        }
      }
    }

    // Send verification email
    console.log('📧 Sending verification email...');
    try {
      const verificationToken = authData.user.id;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}&type=signup`;
      
      const emailResult = await emailService.sendVerificationEmail(email, verificationLink);
      
      if (emailResult) {
        console.log('✅ Verification email sent successfully');
      } else {
        console.error('❌ Failed to send verification email');
      }
    } catch (emailError) {
      console.error('📧 Email error:', emailError);
    }

    console.log('🎉 ENHANCED CLINICIAN REGISTRATION COMPLETED SUCCESSFULLY');
    res.status(201).json({
      message: 'Clinician registered successfully. Please check your email to verify your account.',
      userId: authData.user.id,
      profile: {
        firstName,
        lastName,
        yearsExperience,
        specialties,
        city,
        state,
        currentSchool: currentSchool || null
      }
    });

  } catch (error) {
    console.error('💥 ENHANCED CLINICIAN REGISTRATION EXCEPTION:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, first_name, last_name, email_verified')
      .eq('user_id', data.user.id)
      .single();

    if (profileError) {
      return res.status(400).json({ error: 'Failed to retrieve user profile' });
    }

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userProfile.role,
        firstName: userProfile.first_name,
        lastName: userProfile.last_name,
        emailVerified: userProfile.email_verified
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await supabase.auth.signOut();
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  console.log('🔐 EMAIL VERIFICATION STARTED');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { token, type } = req.body;

    console.log('📧 Verification details:');
    console.log('Token:', token ? `[SET - ${token.substring(0, 10)}...]` : '[NOT SET]');
    console.log('Type:', type || 'signup (default)');

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Since we're using user ID as token, verify the user exists and update their status
    console.log('🔍 Verifying user with custom token system...');
    const verifyStartTime = Date.now();
    
    // First, check if user exists in our users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_id, email_verified, first_name, last_name')
      .eq('user_id', token)
      .single();

    if (userError || !userData) {
      console.error('❌ User not found for verification token:', userError);
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    console.log('✅ User found for verification:', userData.user_id);

    // Update email verified status in Supabase Auth
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      token,
      { email_confirm: true }
    );

    if (authUpdateError) {
      console.error('❌ Error updating Supabase Auth email confirmation:', authUpdateError);
      // Continue anyway, we'll update our own table
    } else {
      console.log('✅ Supabase Auth email confirmation updated');
    }

    // Update email_verified status in our users table
    console.log('📝 Updating email_verified status in users table...');
    const updateStartTime = Date.now();
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ email_verified: true })
      .eq('user_id', token);
    const updateEndTime = Date.now();

    console.log('⏱️ Profile update took:', updateEndTime - updateStartTime, 'ms');

    if (updateError) {
      console.error('❌ Error updating email_verified status:', updateError);
      return res.status(500).json({ error: 'Failed to verify email' });
    } else {
      console.log('✅ Email verified status updated successfully');
    }

    const verifyEndTime = Date.now();
    console.log('⏱️ Total verification took:', verifyEndTime - verifyStartTime, 'ms');

    console.log('🎉 EMAIL VERIFICATION COMPLETED SUCCESSFULLY');
    res.json({ 
      message: 'Email verified successfully',
      user: {
        name: `${userData.first_name} ${userData.last_name}`,
        verified: true
      }
    });
  } catch (error) {
    console.error('💥 EMAIL VERIFICATION EXCEPTION:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Full error object:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset
router.post('/forgot-password', validateRequest(passwordResetSchema), async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CORS_ORIGIN}/auth/reset-password`
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update password
router.post('/update-password', authenticateToken, validateRequest(passwordUpdateSchema), async (req, res) => {
  try {
    const { newPassword } = req.body;

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data: userProfile, error } = await supabase
      .from('users')
      .select(`
        *,
        clinician_profiles(*),
        athlete_profiles(*)
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ user: userProfile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, validateRequest(updateProfileSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const { firstName, lastName, bio, profileImageUrl } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        bio,
        profile_image_url: profileImageUrl
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ user: data });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 
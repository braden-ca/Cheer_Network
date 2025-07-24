import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for regular operations (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for service operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Database types
export interface User {
  user_id: string;
  role: 'athlete' | 'clinician';
  first_name: string;
  last_name: string;
  bio?: string;
  profile_image_url?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClinicianProfile {
  clinician_id: string;
  specialties: string[];
  years_experience: number;
  certifications: string[];
  location?: string;
  hourly_rate?: number;
  verified: boolean;
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface AthleteProfile {
  athlete_id: string;
  age?: number;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  team_affiliation?: string;
  goals?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  event_id: string;
  clinician_id: string;
  title: string;
  description?: string;
  location: string;
  start_date: string;
  end_date: string;
  max_athletes: number;
  current_registrations: number;
  price: number;
  is_private: boolean;
  image_url?: string;
  requirements?: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  registration_id: string;
  event_id: string;
  athlete_id: string;
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  payment_intent_id?: string;
  amount_paid?: number;
  registered_at: string;
}

export interface FollowRelationship {
  follow_id: string;
  athlete_id: string;
  clinician_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  responded_at?: string;
}

export interface Message {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  sent_at: string;
}

export interface SocialPost {
  social_post_id: string;
  user_id: string;
  content: string;
  image_urls: string[];
  likes_count: number;
  created_at: string;
}

export interface NewsPost {
  post_id: string;
  author_id: string;
  title: string;
  content: string;
  featured_image_url?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
} 
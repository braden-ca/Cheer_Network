"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDatabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env' });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
const setupDatabase = async () => {
    console.log('🚀 Setting up Cheer Network database...');
    try {
        console.log('📝 Creating ENUM types...');
        await supabase.rpc('exec_sql', {
            sql: `
        -- Create ENUM types
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM ('athlete', 'clinician');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
          CREATE TYPE follow_status AS ENUM ('pending', 'accepted', 'rejected');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
          CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
          CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'elite');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
        });
        console.log('📝 Creating main tables...');
        await supabase.rpc('exec_sql', {
            sql: `
        -- Users table (extends auth.users)
        CREATE TABLE IF NOT EXISTS public.users (
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
          role user_role NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          bio TEXT,
          profile_image_url TEXT,
          email_verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Lookup tables for dynamic dropdowns
        CREATE TABLE IF NOT EXISTS public.specialties_lookup (
          specialty_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.schools_lookup (
          school_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          city TEXT,
          state TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Clinician profiles
        CREATE TABLE IF NOT EXISTS public.clinician_profiles (
          clinician_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE PRIMARY KEY,
          specialties TEXT[] DEFAULT '{}',
          years_experience INTEGER DEFAULT 0,
          certifications TEXT[] DEFAULT '{}',
          city TEXT,
          state TEXT,
          current_school TEXT,
          hourly_rate DECIMAL(10,2),
          verified BOOLEAN DEFAULT FALSE,
          rating DECIMAL(3,2) DEFAULT 0,
          total_reviews INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Athlete profiles
        CREATE TABLE IF NOT EXISTS public.athlete_profiles (
          athlete_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE PRIMARY KEY,
          age INTEGER,
          skill_level skill_level DEFAULT 'beginner',
          team_affiliation TEXT,
          goals TEXT,
          location TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Events/Clinics
        CREATE TABLE IF NOT EXISTS public.events (
          event_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          clinician_id UUID REFERENCES public.clinician_profiles(clinician_id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          location TEXT NOT NULL,
          start_date TIMESTAMP WITH TIME ZONE NOT NULL,
          end_date TIMESTAMP WITH TIME ZONE NOT NULL,
          max_athletes INTEGER NOT NULL DEFAULT 20,
          current_registrations INTEGER DEFAULT 0,
          price DECIMAL(10,2) DEFAULT 0,
          is_private BOOLEAN DEFAULT FALSE,
          image_url TEXT,
          requirements TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT valid_dates CHECK (end_date > start_date),
          CONSTRAINT positive_price CHECK (price >= 0),
          CONSTRAINT positive_max_athletes CHECK (max_athletes > 0)
        );

        -- Event registrations
        CREATE TABLE IF NOT EXISTS public.event_registrations (
          registration_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE NOT NULL,
          athlete_id UUID REFERENCES public.athlete_profiles(athlete_id) ON DELETE CASCADE NOT NULL,
          payment_status payment_status DEFAULT 'pending',
          payment_intent_id TEXT,
          amount_paid DECIMAL(10,2),
          registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(event_id, athlete_id)
        );

        -- Follow relationships
        CREATE TABLE IF NOT EXISTS public.follow_relationships (
          follow_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          athlete_id UUID REFERENCES public.athlete_profiles(athlete_id) ON DELETE CASCADE NOT NULL,
          clinician_id UUID REFERENCES public.clinician_profiles(clinician_id) ON DELETE CASCADE NOT NULL,
          status follow_status DEFAULT 'pending',
          requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          responded_at TIMESTAMP WITH TIME ZONE,
          UNIQUE(athlete_id, clinician_id)
        );

        -- Messages
        CREATE TABLE IF NOT EXISTS public.messages (
          message_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          sender_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
          receiver_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
          content TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT no_self_message CHECK (sender_id != receiver_id)
        );

        -- Private event access
        CREATE TABLE IF NOT EXISTS public.private_event_access (
          access_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE NOT NULL,
          athlete_id UUID REFERENCES public.athlete_profiles(athlete_id) ON DELETE CASCADE NOT NULL,
          granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(event_id, athlete_id)
        );

        -- News/Blog posts
        CREATE TABLE IF NOT EXISTS public.news_posts (
          post_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          author_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          featured_image_url TEXT,
          published BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Social posts
        CREATE TABLE IF NOT EXISTS public.social_posts (
          social_post_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
          content TEXT NOT NULL,
          image_urls TEXT[] DEFAULT '{}',
          likes_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Post likes
        CREATE TABLE IF NOT EXISTS public.post_likes (
          like_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          post_id UUID REFERENCES public.social_posts(social_post_id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(post_id, user_id)
        );
      `
        });
        console.log('📝 Creating indexes...');
        await supabase.rpc('exec_sql', {
            sql: `
        -- Performance indexes
        CREATE INDEX IF NOT EXISTS idx_events_clinician_id ON public.events(clinician_id);
        CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
        CREATE INDEX IF NOT EXISTS idx_events_location ON public.events(location);
        CREATE INDEX IF NOT EXISTS idx_events_is_private ON public.events(is_private);
        
        CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON public.event_registrations(event_id);
        CREATE INDEX IF NOT EXISTS idx_registrations_athlete_id ON public.event_registrations(athlete_id);
        CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON public.event_registrations(payment_status);
        
        CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON public.messages(sent_at);
        CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(read);
        
        CREATE INDEX IF NOT EXISTS idx_follow_relationships_athlete ON public.follow_relationships(athlete_id);
        CREATE INDEX IF NOT EXISTS idx_follow_relationships_clinician ON public.follow_relationships(clinician_id);
        CREATE INDEX IF NOT EXISTS idx_follow_relationships_status ON public.follow_relationships(status);
        
        CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON public.social_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON public.social_posts(created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_specialties_lookup_name ON public.specialties_lookup(name);
        CREATE INDEX IF NOT EXISTS idx_schools_lookup_name ON public.schools_lookup(name);
        CREATE INDEX IF NOT EXISTS idx_schools_lookup_location ON public.schools_lookup(city, state);
        CREATE INDEX IF NOT EXISTS idx_clinician_profiles_city_state ON public.clinician_profiles(city, state);
        CREATE INDEX IF NOT EXISTS idx_clinician_profiles_school ON public.clinician_profiles(current_school);
      `
        });
        console.log('📝 Creating functions and triggers...');
        await supabase.rpc('exec_sql', {
            sql: `
        -- Function to update updated_at timestamp
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Function to update event registration count
        CREATE OR REPLACE FUNCTION update_event_registration_count()
        RETURNS TRIGGER AS $$
        BEGIN
          IF TG_OP = 'INSERT' THEN
            UPDATE public.events 
            SET current_registrations = current_registrations + 1 
            WHERE event_id = NEW.event_id;
            RETURN NEW;
          ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.events 
            SET current_registrations = current_registrations - 1 
            WHERE event_id = OLD.event_id;
            RETURN OLD;
          END IF;
          RETURN NULL;
        END;
        $$ language 'plpgsql';

        -- Function to update post likes count
        CREATE OR REPLACE FUNCTION update_post_likes_count()
        RETURNS TRIGGER AS $$
        BEGIN
          IF TG_OP = 'INSERT' THEN
            UPDATE public.social_posts 
            SET likes_count = likes_count + 1 
            WHERE social_post_id = NEW.post_id;
            RETURN NEW;
          ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.social_posts 
            SET likes_count = likes_count - 1 
            WHERE social_post_id = OLD.post_id;
            RETURN OLD;
          END IF;
          RETURN NULL;
        END;
        $$ language 'plpgsql';

        -- Create triggers
        DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON public.users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_clinician_profiles_updated_at ON public.clinician_profiles;
        CREATE TRIGGER update_clinician_profiles_updated_at
          BEFORE UPDATE ON public.clinician_profiles
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_athlete_profiles_updated_at ON public.athlete_profiles;
        CREATE TRIGGER update_athlete_profiles_updated_at
          BEFORE UPDATE ON public.athlete_profiles
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
        CREATE TRIGGER update_events_updated_at
          BEFORE UPDATE ON public.events
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_news_posts_updated_at ON public.news_posts;
        CREATE TRIGGER update_news_posts_updated_at
          BEFORE UPDATE ON public.news_posts
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS event_registration_count_trigger ON public.event_registrations;
        CREATE TRIGGER event_registration_count_trigger
          AFTER INSERT OR DELETE ON public.event_registrations
          FOR EACH ROW EXECUTE FUNCTION update_event_registration_count();

        DROP TRIGGER IF EXISTS post_likes_count_trigger ON public.post_likes;
        CREATE TRIGGER post_likes_count_trigger
          AFTER INSERT OR DELETE ON public.post_likes
          FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
      `
        });
        console.log('📝 Setting up RLS policies...');
        await supabase.rpc('exec_sql', {
            sql: `
        -- Enable RLS on all tables
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.follow_relationships ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.private_event_access ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.specialties_lookup ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.schools_lookup ENABLE ROW LEVEL SECURITY;

        -- Users policies
        DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
        CREATE POLICY "Users can view their own profile" ON public.users
          FOR SELECT USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Anyone can view clinician user info" ON public.users;
        CREATE POLICY "Anyone can view clinician user info" ON public.users
          FOR SELECT TO authenticated USING (
            user_id IN (
              SELECT clinician_id FROM public.clinician_profiles
            )
          );

        DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
        CREATE POLICY "Users can update their own profile" ON public.users
          FOR UPDATE USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
        CREATE POLICY "Users can insert their own profile" ON public.users
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        -- Clinician profiles policies
        DROP POLICY IF EXISTS "Clinicians can manage their own profile" ON public.clinician_profiles;
        CREATE POLICY "Clinicians can manage their own profile" ON public.clinician_profiles
          FOR ALL USING (auth.uid() = clinician_id);

        DROP POLICY IF EXISTS "Anyone can view clinician profiles" ON public.clinician_profiles;
        CREATE POLICY "Anyone can view clinician profiles" ON public.clinician_profiles
          FOR SELECT TO authenticated USING (true);

        -- Athlete profiles policies
        DROP POLICY IF EXISTS "Athletes can manage their own profile" ON public.athlete_profiles;
        CREATE POLICY "Athletes can manage their own profile" ON public.athlete_profiles
          FOR ALL USING (auth.uid() = athlete_id);

        -- Events policies
        DROP POLICY IF EXISTS "Everyone can view public events" ON public.events;
        CREATE POLICY "Everyone can view public events" ON public.events
          FOR SELECT TO authenticated USING (
            NOT is_private OR 
            clinician_id = auth.uid() OR 
            EXISTS (
              SELECT 1 FROM public.private_event_access 
              WHERE event_id = events.event_id AND athlete_id = auth.uid()
            )
          );

        DROP POLICY IF EXISTS "Clinicians can manage their own events" ON public.events;
        CREATE POLICY "Clinicians can manage their own events" ON public.events
          FOR ALL USING (auth.uid() = clinician_id);

        -- Event registrations policies
        DROP POLICY IF EXISTS "Users can view their own registrations" ON public.event_registrations;
        CREATE POLICY "Users can view their own registrations" ON public.event_registrations
          FOR SELECT USING (
            auth.uid() = athlete_id OR 
            auth.uid() = (SELECT clinician_id FROM public.events WHERE event_id = event_registrations.event_id)
          );

        DROP POLICY IF EXISTS "Athletes can register for events" ON public.event_registrations;
        CREATE POLICY "Athletes can register for events" ON public.event_registrations
          FOR INSERT WITH CHECK (auth.uid() = athlete_id);

        DROP POLICY IF EXISTS "Athletes can update their registrations" ON public.event_registrations;
        CREATE POLICY "Athletes can update their registrations" ON public.event_registrations
          FOR UPDATE USING (auth.uid() = athlete_id);

        -- Follow relationships policies
        DROP POLICY IF EXISTS "Users can view relevant follow relationships" ON public.follow_relationships;
        CREATE POLICY "Users can view relevant follow relationships" ON public.follow_relationships
          FOR SELECT USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

        DROP POLICY IF EXISTS "Athletes can create follow requests" ON public.follow_relationships;
        CREATE POLICY "Athletes can create follow requests" ON public.follow_relationships
          FOR INSERT WITH CHECK (auth.uid() = athlete_id);

        DROP POLICY IF EXISTS "Users can update their follow relationships" ON public.follow_relationships;
        CREATE POLICY "Users can update their follow relationships" ON public.follow_relationships
          FOR UPDATE USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

        -- Messages policies
        DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
        CREATE POLICY "Users can view their own messages" ON public.messages
          FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

        DROP POLICY IF EXISTS "Users can send messages to connected users" ON public.messages;
        CREATE POLICY "Users can send messages to connected users" ON public.messages
          FOR INSERT WITH CHECK (
            auth.uid() = sender_id AND (
              EXISTS (
                SELECT 1 FROM public.follow_relationships 
                WHERE (athlete_id = sender_id AND clinician_id = receiver_id AND status = 'accepted') OR
                      (athlete_id = receiver_id AND clinician_id = sender_id AND status = 'accepted')
              )
            )
          );

        DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
        CREATE POLICY "Users can update their received messages" ON public.messages
          FOR UPDATE USING (auth.uid() = receiver_id);

        -- Private event access policies
        DROP POLICY IF EXISTS "Clinicians can manage private event access" ON public.private_event_access;
        CREATE POLICY "Clinicians can manage private event access" ON public.private_event_access
          FOR ALL USING (
            auth.uid() = (SELECT clinician_id FROM public.events WHERE event_id = private_event_access.event_id)
          );

        DROP POLICY IF EXISTS "Athletes can view their private event access" ON public.private_event_access;
        CREATE POLICY "Athletes can view their private event access" ON public.private_event_access
          FOR SELECT USING (auth.uid() = athlete_id);

        -- News posts policies
        DROP POLICY IF EXISTS "Everyone can read published news" ON public.news_posts;
        CREATE POLICY "Everyone can read published news" ON public.news_posts
          FOR SELECT TO authenticated USING (published = true);

        DROP POLICY IF EXISTS "Authors can manage their news posts" ON public.news_posts;
        CREATE POLICY "Authors can manage their news posts" ON public.news_posts
          FOR ALL USING (auth.uid() = author_id);

        -- Social posts policies
        DROP POLICY IF EXISTS "Everyone can view social posts" ON public.social_posts;
        CREATE POLICY "Everyone can view social posts" ON public.social_posts
          FOR SELECT TO authenticated USING (true);

        DROP POLICY IF EXISTS "Users can manage their own social posts" ON public.social_posts;
        CREATE POLICY "Users can manage their own social posts" ON public.social_posts
          FOR ALL USING (auth.uid() = user_id);

        -- Post likes policies
        DROP POLICY IF EXISTS "Users can view post likes" ON public.post_likes;
        CREATE POLICY "Users can view post likes" ON public.post_likes
          FOR SELECT TO authenticated USING (true);

        DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
        CREATE POLICY "Users can like posts" ON public.post_likes
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
        CREATE POLICY "Users can unlike posts" ON public.post_likes
          FOR DELETE USING (auth.uid() = user_id);

        -- Specialties lookup policies
        DROP POLICY IF EXISTS "Anyone can view specialties" ON public.specialties_lookup;
        CREATE POLICY "Anyone can view specialties" ON public.specialties_lookup
          FOR SELECT TO authenticated USING (true);

        DROP POLICY IF EXISTS "Authenticated users can add specialties" ON public.specialties_lookup;
        CREATE POLICY "Authenticated users can add specialties" ON public.specialties_lookup
          FOR INSERT TO authenticated WITH CHECK (true);

        -- Schools lookup policies
        DROP POLICY IF EXISTS "Anyone can view schools" ON public.schools_lookup;
        CREATE POLICY "Anyone can view schools" ON public.schools_lookup
          FOR SELECT TO authenticated USING (true);

        DROP POLICY IF EXISTS "Authenticated users can add schools" ON public.schools_lookup;
        CREATE POLICY "Authenticated users can add schools" ON public.schools_lookup
          FOR INSERT TO authenticated WITH CHECK (true);
      `
        });
        console.log('📝 Adding initial specialty data...');
        const initialSpecialties = [
            'Tumbling',
            'Stunting',
            'Jumps',
            'Dance/Choreography',
            'Conditioning',
            'Flexibility',
            'Competition Prep',
            'Team Building',
            'Mental Performance',
            'Injury Prevention',
            'Nutrition',
            'Leadership Development'
        ];
        for (const specialty of initialSpecialties) {
            try {
                await supabase
                    .from('specialties_lookup')
                    .insert({ name: specialty })
                    .select()
                    .single();
            }
            catch (error) {
                console.log(`Specialty "${specialty}" already exists or failed to insert`);
            }
        }
        console.log('✅ Database setup completed successfully!');
        console.log('📊 Tables created:');
        console.log('   - users');
        console.log('   - clinician_profiles');
        console.log('   - athlete_profiles');
        console.log('   - events');
        console.log('   - event_registrations');
        console.log('   - follow_relationships');
        console.log('   - messages');
        console.log('   - private_event_access');
        console.log('   - news_posts');
        console.log('   - social_posts');
        console.log('   - post_likes');
        console.log('   - specialties_lookup');
        console.log('   - schools_lookup');
        console.log('🔒 RLS policies enabled for all tables');
        console.log('⚡ Triggers and functions created');
        console.log('📈 Performance indexes created');
    }
    catch (error) {
        console.error('❌ Error setting up database:', error);
        process.exit(1);
    }
};
exports.setupDatabase = setupDatabase;
if (require.main === module) {
    setupDatabase().then(() => {
        console.log('🎉 Database setup script completed!');
        process.exit(0);
    });
}
//# sourceMappingURL=setup-database.js.map
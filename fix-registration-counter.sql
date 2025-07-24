-- Fix Registration Counter - Only Count Paid Registrations
-- This script updates the trigger to only count registrations with payment_status = 'paid'

-- First, reset all current_registrations counts to match actual paid registrations
UPDATE public.events 
SET current_registrations = (
  SELECT COUNT(*) 
  FROM public.event_registrations 
  WHERE event_registrations.event_id = events.event_id 
  AND payment_status = 'paid'
);

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS event_registration_count_trigger ON public.event_registrations;
DROP FUNCTION IF EXISTS update_event_registration_count();

-- Create updated function that only counts paid registrations
CREATE OR REPLACE FUNCTION update_event_registration_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only increment if the new registration is paid
    IF NEW.payment_status = 'paid' THEN
      UPDATE public.events 
      SET current_registrations = current_registrations + 1 
      WHERE event_id = NEW.event_id;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle payment status changes
    IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
      -- Payment completed: increment counter
      UPDATE public.events 
      SET current_registrations = current_registrations + 1 
      WHERE event_id = NEW.event_id;
    ELSIF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
      -- Payment reversed/refunded: decrement counter
      UPDATE public.events 
      SET current_registrations = current_registrations - 1 
      WHERE event_id = NEW.event_id;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement if the deleted registration was paid
    IF OLD.payment_status = 'paid' THEN
      UPDATE public.events 
      SET current_registrations = current_registrations - 1 
      WHERE event_id = OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Create the updated trigger that handles INSERT, UPDATE, and DELETE
CREATE TRIGGER event_registration_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_event_registration_count();

-- Verify the update by showing current counts
SELECT 
  e.title,
  e.current_registrations as "Current Count",
  (SELECT COUNT(*) FROM public.event_registrations er WHERE er.event_id = e.event_id AND er.payment_status = 'paid') as "Actual Paid Count"
FROM public.events e
ORDER BY e.created_at DESC; 
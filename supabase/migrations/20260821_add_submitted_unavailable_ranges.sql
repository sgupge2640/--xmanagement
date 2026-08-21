ALTER TABLE public.shift_applications
ADD COLUMN IF NOT EXISTS submitted_unavailable_ranges jsonb DEFAULT NULL;
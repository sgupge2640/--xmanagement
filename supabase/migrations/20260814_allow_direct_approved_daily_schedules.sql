ALTER TABLE public.daily_schedules
DROP CONSTRAINT IF EXISTS daily_schedules_status_check;

ALTER TABLE public.daily_schedules
ADD CONSTRAINT daily_schedules_status_check
CHECK (
  status = ANY (
    ARRAY[
      'pending'::text,
      'approved'::text,
      'rejected'::text,
      'direct_approved'::text
    ]
  )
);
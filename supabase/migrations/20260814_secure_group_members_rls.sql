BEGIN;

-- Helper: resolve current user email from JWT claims.
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(
    coalesce(
      nullif(auth.jwt() ->> 'email', ''),
      nullif(current_setting('request.jwt.claim.email', true), '')
    )
  );
$$;

-- SECURITY DEFINER helpers avoid RLS self-recursion on group_members.
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND lower(gm.user_email) = public.current_user_email()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND lower(gm.user_email) = public.current_user_email()
      AND gm.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_group_id
      AND lower(g.created_by) = public.current_user_email()
  );
$$;

-- Allows users to update their own display/email row without role/group escalation.
CREATE OR REPLACE FUNCTION public.can_self_update_group_member(
  p_member_id bigint,
  p_new_group_id bigint,
  p_new_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_old_group_id bigint;
  v_old_role text;
  v_old_user_email text;
BEGIN
  SELECT gm.group_id, gm.role, gm.user_email
  INTO v_old_group_id, v_old_role, v_old_user_email
  FROM public.group_members gm
  WHERE gm.id = p_member_id;

  IF v_old_group_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN lower(v_old_user_email) = public.current_user_email()
    AND v_old_group_id = p_new_group_id
    AND v_old_role = p_new_role;
END;
$$;

-- Tighten SQL privileges first; access is then constrained by RLS.
REVOKE ALL ON TABLE public.group_members FROM anon;
REVOKE ALL ON TABLE public.group_members FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_members TO authenticated;

DO $$
DECLARE
  v_seq text;
BEGIN
  SELECT pg_get_serial_sequence('public.group_members', 'id') INTO v_seq;
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', v_seq);
  END IF;
END
$$;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_members_select_policy ON public.group_members;
CREATE POLICY group_members_select_policy
ON public.group_members
FOR SELECT
TO authenticated
USING (
  public.is_group_member(group_id)
  OR public.is_group_admin(group_id)
);

DROP POLICY IF EXISTS group_members_insert_policy ON public.group_members;
CREATE POLICY group_members_insert_policy
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Create-group flow: creator inserts own admin membership for the new group.
  (
    lower(user_email) = public.current_user_email()
    AND role = 'admin'
    AND EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = group_id
        AND lower(g.created_by) = public.current_user_email()
    )
  )
  OR public.is_group_admin(group_id)
);

DROP POLICY IF EXISTS group_members_update_policy ON public.group_members;
CREATE POLICY group_members_update_policy
ON public.group_members
FOR UPDATE
TO authenticated
USING (
  public.is_group_admin(group_id)
  OR lower(user_email) = public.current_user_email()
)
WITH CHECK (
  public.is_group_admin(group_id)
  OR public.can_self_update_group_member(id, group_id, role)
);

DROP POLICY IF EXISTS group_members_delete_policy ON public.group_members;
CREATE POLICY group_members_delete_policy
ON public.group_members
FOR DELETE
TO authenticated
USING (
  public.is_group_admin(group_id)
  OR lower(user_email) = public.current_user_email()
);

COMMIT;

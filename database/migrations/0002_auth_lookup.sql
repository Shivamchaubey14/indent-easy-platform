-- Sign-in lookups that cross the organisation boundary.
--
-- Row-level security scopes every identity query to one organisation (app.org_id). Before a user
-- is authenticated that organisation is unknown, so these two functions answer the only questions
-- sign-in needs: "which account does this identifier belong to?" and "which organisation does
-- this user belong to?". They run as the schema owner (SECURITY DEFINER), return ids only, and
-- are the sole way the app role can read across organisations.
CREATE FUNCTION identity.find_login_account(p_identifier text)
RETURNS TABLE (user_id uuid, organization_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- E-mail is unique across the platform; employee codes only within an organisation, so an
  -- employee code shared by two organisations matches nothing rather than the wrong account.
  SELECT u.id, u.organization_id
  FROM identity.app_user u
  WHERE u.email = p_identifier::citext
  UNION ALL
  SELECT u.id, u.organization_id
  FROM identity.app_user u
  WHERE u.employee_code = p_identifier
    AND NOT EXISTS (SELECT 1 FROM identity.app_user e WHERE e.email = p_identifier::citext)
    AND (SELECT count(*) FROM identity.app_user c WHERE c.employee_code = p_identifier) = 1
$$;
--> statement-breakpoint
CREATE FUNCTION identity.user_organization(p_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT organization_id FROM identity.app_user WHERE id = p_user_id
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION identity.find_login_account(text), identity.user_organization(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION identity.find_login_account(text), identity.user_organization(uuid) TO ie_app;

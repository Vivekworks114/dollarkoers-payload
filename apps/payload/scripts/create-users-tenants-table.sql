-- Multi-tenant plugin: users ↔ tenants assignment table.
-- Required when tenantsArrayField.includeDefaultField is true.
--
-- Run on production if you see: relation "users_tenants" does not exist
--
--   psql "$DATABASE_URI" -f apps/payload/scripts/create-users-tenants-table.sql

-- Payload array rows use varchar ids (same pattern as users_roles, etc.)
CREATE TABLE IF NOT EXISTS "users_tenants" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL
);

-- Verify after running:
--   SELECT COUNT(*) FROM users_tenants;
--   \d users_tenants

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenants_parent_id_fk'
  ) THEN
    ALTER TABLE "users_tenants"
      ADD CONSTRAINT "users_tenants_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenants_tenant_id_fk'
  ) THEN
    ALTER TABLE "users_tenants"
      ADD CONSTRAINT "users_tenants_tenant_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_tenants_order_idx" ON "users_tenants" ("_order");
CREATE INDEX IF NOT EXISTS "users_tenants_parent_id_idx" ON "users_tenants" ("_parent_id");
CREATE INDEX IF NOT EXISTS "users_tenants_tenant_id_idx" ON "users_tenants" ("tenant_id");

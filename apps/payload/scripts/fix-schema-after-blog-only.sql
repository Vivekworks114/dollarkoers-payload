-- Run once when Drizzle push fails with:
--   constraint "payload_locked_documents_rels_pages_fk" does not exist
--
-- Usage (local):
--   psql "$DATABASE_URI" -f apps/payload/scripts/fix-schema-after-blog-only.sql
--
-- Safe to re-run (IF EXISTS).

-- 1. Locked-documents rels: drop FKs for removed collections
ALTER TABLE IF EXISTS payload_locked_documents_rels
  DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_pages_fk;
ALTER TABLE IF EXISTS payload_locked_documents_rels
  DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_products_fk;
ALTER TABLE IF EXISTS payload_locked_documents_rels
  DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_top10s_fk;
ALTER TABLE IF EXISTS payload_locked_documents_rels
  DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_businesses_fk;
ALTER TABLE IF EXISTS payload_locked_documents_rels
  DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_redirects_fk;
ALTER TABLE IF EXISTS payload_locked_documents_rels
  DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_nav_menus_fk;

-- 2. Drop rel columns for removed collections (if still present)
ALTER TABLE IF EXISTS payload_locked_documents_rels DROP COLUMN IF EXISTS pages_id;
ALTER TABLE IF EXISTS payload_locked_documents_rels DROP COLUMN IF EXISTS products_id;
ALTER TABLE IF EXISTS payload_locked_documents_rels DROP COLUMN IF EXISTS top10s_id;
ALTER TABLE IF EXISTS payload_locked_documents_rels DROP COLUMN IF EXISTS businesses_id;
ALTER TABLE IF EXISTS payload_locked_documents_rels DROP COLUMN IF EXISTS redirects_id;
ALTER TABLE IF EXISTS payload_locked_documents_rels DROP COLUMN IF EXISTS nav_menus_id;

-- 3. Drop old collection tables (blog-only refactor; destroys that CMS data)
DROP TABLE IF EXISTS top10s_products CASCADE;
DROP TABLE IF EXISTS top10s_faq CASCADE;
DROP TABLE IF EXISTS top10s CASCADE;
DROP TABLE IF EXISTS products_specs CASCADE;
DROP TABLE IF EXISTS products_pros CASCADE;
DROP TABLE IF EXISTS products_cons CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS redirects CASCADE;
DROP TABLE IF EXISTS nav_menus_items_children CASCADE;
DROP TABLE IF EXISTS nav_menus_items CASCADE;
DROP TABLE IF EXISTS nav_menus CASCADE;

-- 4. Old affiliate columns on tenants
ALTER TABLE IF EXISTS tenants DROP COLUMN IF EXISTS bol_publisher_id;
ALTER TABLE IF EXISTS tenants DROP COLUMN IF EXISTS awin_id;
ALTER TABLE IF EXISTS tenants DROP COLUMN IF EXISTS amazon_tag;

-- Relia production schema for Supabase (PostgreSQL + pgvector)
-- Apply with: supabase db push   or run in order via the SQL editor.

create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

# Database Workflow - Senior Dev Approach

## The Right Way to Manage Database Changes

**Never touch the Supabase dashboard for schema changes.** Use migrations like a professional.

## Quick Reference

```bash
# Push migrations to remote database
pnpm db:push

# Create a new migration
pnpm db:migration <migration_name>

# Pull remote schema (create migration from remote changes)
pnpm db:pull

# Check migration status
pnpm db:status

# Generate TypeScript types from database
pnpm db:types
```

## Initial Setup (One Time)

Your project is already set up with:
- ✅ Supabase CLI installed
- ✅ Migration file exists: `supabase/migrations/20250120_reset_and_rebuild.sql`
- ✅ Package.json scripts configured

### First Time: Push Existing Migration to Remote

```bash
# This applies your local migration to the remote Supabase database
pnpm db:push
```

This will:
1. Connect to your remote Supabase project
2. Apply the migration file
3. Create all tables, functions, RLS policies, etc.
4. Fix the 500 errors you're seeing

## Daily Workflow

### Making Schema Changes

**Option 1: Direct Migration File (Preferred for Complex Changes)**

1. Create a new migration:
```bash
pnpm db:migration add_user_avatar
```

2. Edit the generated file in `supabase/migrations/`

3. Write your SQL:
```sql
-- Add avatar column to users
ALTER TABLE public.users ADD COLUMN avatar_url TEXT;

-- Add index for faster lookups
CREATE INDEX idx_users_avatar ON public.users(avatar_url);
```

4. Push to remote:
```bash
pnpm db:push
```

5. Update TypeScript types:
```bash
pnpm db:types
```

**Option 2: Pull Remote Changes (If You Made Dashboard Changes)**

If you accidentally made changes in the dashboard:

```bash
# Pull changes and create a migration file
pnpm db:pull

# Review the generated migration file
# Then push it (or delete it if unwanted)
pnpm db:push
```

### Checking What's Applied

```bash
# See which migrations are applied locally and remotely
pnpm db:status
```

## Local Development (Optional but Recommended)

Run Supabase locally for faster development:

```bash
# Start local Supabase (PostgreSQL + Studio)
pnpm supabase:start

# Check what's running
pnpm supabase:status

# Stop when done
pnpm supabase:stop
```

When running locally:
- Studio UI: http://localhost:54323
- PostgreSQL: localhost:54322
- Update `.env.local` to point to local instance

## Migration Best Practices

### ✅ DO

- **Version control everything**: All migrations in git
- **One migration per feature**: Keep changes focused
- **Use transactions**: Wrap DDL in `BEGIN`/`COMMIT` for safety
- **Test locally first**: Use local Supabase before pushing
- **Generate types after changes**: Always run `pnpm db:types`

### ❌ DON'T

- **Never edit old migrations**: Create new ones instead
- **Don't skip migrations**: They must run in order
- **Don't make schema changes in dashboard**: Use migrations
- **Don't commit without testing**: Run locally first

## Example: Adding a Feature

Let's say you want to add user profiles with bio and avatar:

### Step 1: Create Migration
```bash
pnpm db:migration user_profiles
```

### Step 2: Write Migration (`supabase/migrations/YYYYMMDD_user_profiles.sql`)
```sql
-- Add profile fields to users table
ALTER TABLE public.users
  ADD COLUMN bio TEXT,
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Add index for timezone lookups
CREATE INDEX idx_users_timezone ON public.users(timezone);

-- Update RLS policies if needed
-- (policies here)
```

### Step 3: Test Locally (Optional)
```bash
pnpm supabase:start
pnpm db:push  # Applies to local DB
# Test in your app with local Supabase
```

### Step 4: Push to Remote
```bash
pnpm db:push  # Applies to remote DB
```

### Step 5: Update Types
```bash
pnpm db:types
```

### Step 6: Commit
```bash
git add supabase/migrations lib/database.types.ts
git commit -m "feat: add user profile fields"
```

## Troubleshooting

### Migration Failed

```bash
# Check what failed
pnpm db:status

# If needed, create a rollback migration
pnpm db:migration rollback_user_profiles

# Write the reverse SQL
ALTER TABLE public.users
  DROP COLUMN bio,
  DROP COLUMN avatar_url,
  DROP COLUMN timezone;

# Push the rollback
pnpm db:push
```

### Out of Sync

If local and remote are out of sync:

```bash
# Pull remote state
pnpm db:pull

# Review the generated migration
# Push if it looks correct
pnpm db:push
```

### Need to Reset Everything

```bash
# Local only (safe)
pnpm db:reset

# Remote (DANGER: deletes all data)
# Run the reset migration through dashboard or create new migration
```

## Why This Approach?

### Traditional Way (Bad)
1. Open Supabase dashboard
2. Click around in UI
3. Make changes
4. Forget what you changed
5. Team member has different schema
6. Production breaks

### Professional Way (Good)
1. Create migration file
2. Write SQL
3. Version control
4. Review in PR
5. Test locally
6. Push to remote
7. Team is in sync
8. Rollback is easy

## Team Workflow

When working with a team:

```bash
# Pull latest migrations from git
git pull

# Apply new migrations
pnpm db:push

# Update types
pnpm db:types

# Now you're in sync!
```

## Current Status

You have one migration that needs to be pushed:
- `supabase/migrations/20250120_reset_and_rebuild.sql`

**Run this now to fix your 500 errors:**

```bash
pnpm db:push
```

This will create all the messaging tables and your app will work!

---

**Remember**: Migrations are your single source of truth. The database is just a reflection of your migrations.

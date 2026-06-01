# Root Cause Analysis: "Permission Denied for Table Users" Error

## Executive Summary

The **"permission denied for table users"** error occurs when authenticated users attempt to access Supabase tables with Row Level Security (RLS) policies that directly query the `auth.users` table. The `auth.users` table is managed by Supabase's authentication system and is not accessible to regular authenticated users via RLS policy expressions. This is a security design constraint in Supabase.

## Root Cause

### Primary Issue: Direct `auth.users` Table Access in RLS Policies

The `final_schema.sql` file contains multiple RLS policies that directly query `auth.users`:

```sql
-- PROBLEMATIC PATTERN (from final_schema.sql)
CREATE POLICY "Restaurants: owner manage" ON restaurants FOR ALL 
USING (org_id = (SELECT email FROM auth.users WHERE id = auth.uid()));
```

When Supabase evaluates this policy for an authenticated user, it attempts to execute:
```sql
SELECT email FROM auth.users WHERE id = auth.uid()
```

Since `auth.users` is a protected system table, this query fails with **"permission denied for table users"**.

### Secondary Issue: Missing INSERT Policy on `profiles` Table

The application's authentication flow (in `supabaseClient.js`) calls:

```javascript
async updateMe(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles').upsert({ 
    id: user.id, 
    email: user.email, 
    ...updates, 
    updated_date: new Date().toISOString() 
  });
  if (error) throw error;
  return auth.me();
}
```

The `upsert` operation requires an `INSERT` policy on the `profiles` table when the profile does not yet exist. The original schema only provided `SELECT` and `UPDATE` policies, preventing profile creation during onboarding.

### Tertiary Issue: Trigger Function Robustness

The `handle_new_user()` trigger function uses `ON CONFLICT (id) DO NOTHING`, which silently fails if a profile already exists. This can leave users without proper profile data during edge cases.

## Impact on User Flow

| Step | Issue | Impact |
|------|-------|--------|
| 1. Signup | User created in `auth.users` | ✅ Works |
| 2. Trigger fires | `handle_new_user()` inserts into `profiles` | ✅ Works |
| 3. Login | `auth.me()` calls `supabase.from('profiles').select()` | ❌ Fails - RLS evaluates "Restaurants: owner manage" policy |
| 4. Dashboard load | App tries to fetch restaurants | ❌ Fails - Policy queries `auth.users` |
| 5. Onboarding | User tries to create restaurant | ❌ Fails - Restaurant creation requires RLS policy evaluation |

## Solution

### 1. Replace `auth.users` with `auth.jwt()`

Supabase provides the `auth.jwt()` function which returns the JWT token claims without accessing the `auth.users` table:

```sql
-- CORRECT PATTERN
CREATE POLICY "Restaurants: owner manage" ON restaurants FOR ALL 
USING (org_id = (auth.jwt() ->> 'email'));
```

The JWT token contains the user's email claim and is accessible within RLS policy expressions.

### 2. Add INSERT Policy to `profiles` Table

```sql
CREATE POLICY "Profiles: self insert" ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);
```

This allows authenticated users to insert their own profile record.

### 3. Improve Trigger Function

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Tables Affected

The following tables had RLS policies that required fixing:

| Table | Policies Updated | Reason |
|-------|------------------|--------|
| `restaurants` | owner manage, staff view | Direct `auth.users` query |
| `branches` | All | Missing policies entirely |
| `categories` | All | Direct `auth.users` query |
| `products` | owner manage, staff view | Direct `auth.users` query |
| `inventory` | owner manage | Direct `auth.users` query |
| `customers` | owner manage, staff view | Direct `auth.users` query |
| `suppliers` | owner manage, staff view | Direct `auth.users` query |
| `orders` | owner manage | Direct `auth.users` query |
| `expenses` | owner manage | Direct `auth.users` query |
| `payments` | owner manage | Direct `auth.users` query |
| `reservations` | owner manage | Direct `auth.users` query |
| `daily_sales` | owner manage | Direct `auth.users` query |
| `profiles` | Added INSERT policy | Missing self-insert capability |

## Application Code Compatibility

The application code in `supabaseClient.js` is already compatible with the fix:

1. **Profile Creation**: The `updateMe()` function uses `upsert()`, which now works with the new INSERT policy.
2. **Restaurant Filtering**: The `TenantContext.jsx` filters restaurants by `org_id: user.email`, which matches the new JWT-based policy.
3. **Entity Creation**: All entity creation methods inject `created_by: email` automatically, which aligns with the new policies.

## Verification Steps

After applying the SQL fix, the following should work:

1. ✅ User signup and email verification
2. ✅ User login and profile load
3. ✅ Restaurant creation during onboarding
4. ✅ Dashboard access and data loading
5. ✅ Category, product, customer, and order creation
6. ✅ Inventory and supplier management

## Files Modified

- `src/supabase/final_schema.sql` - Updated with corrected RLS policies
- `supabase_fix.sql` - Migration script containing all fixes

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JWT Claims](https://supabase.com/docs/guides/auth/auth-helpers/auth-helpers-nextjs#user-context)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

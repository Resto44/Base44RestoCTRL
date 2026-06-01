# Supabase Setup Guide

This application uses Supabase for Authentication and Database management.

## Setup Instructions

1.  **Create a Supabase Project:**
    *   Go to [Supabase](https://supabase.com/) and create a new project.
    *   Obtain your `Project URL` and `Anon Key` from the API settings.

2.  **Apply Database Schema:**
    *   Copy the contents of `src/supabase/schema.sql`.
    *   Paste and run it in the Supabase SQL Editor to create the necessary tables and relationships.

3.  **Authentication:**
    *   Enable Email/Password authentication in the Supabase Auth settings.
    *   Configure redirect URLs if necessary.

4.  **Row Level Security (RLS):**
    *   Ensure RLS is configured for your tables to protect user data.
    *   Refer to `schema.sql` for initial RLS policies.

5.  **Environment Variables:**
    *   Update your `.env` file or deployment environment with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

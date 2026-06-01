# Production Deployment Guide

This project is a Vite + React application with Base44 and Supabase integration, ready for deployment on Vercel.

## Deployment Steps

1.  **Environment Variables:** Ensure the following environment variables are set in your Vercel project settings:
    *   `VITE_SUPABASE_URL`: Your Supabase project URL.
    *   `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key.
    *   `VITE_BASE44_APP_ID`: Your Base44 application ID.
    *   `VITE_BASE44_APP_BASE_URL`: Your Base44 application base URL.
    *   `VITE_BASE44_FUNCTIONS_VERSION`: Set to `v1` (default).

2.  **Vercel Configuration:**
    *   **Framework Preset:** Vite
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `dist`
    *   **SPA Routing:** Handled by `vercel.json`.

3.  **Supabase Setup:**
    *   Ensure the database schema is applied using the provided `src/supabase/schema.sql`.
    *   Configure Authentication and Row Level Security (RLS) as required.

## Local Build Verification

To verify the build locally:

```bash
npm install
npm run build
```

The output will be generated in the `dist/` directory.

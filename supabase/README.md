# Supabase Configuration

## Project Information
- Project ID: `prmaxfslqpmfasmqushk`
- Region: ap-northeast-1  
- URL: https://prmaxfslqpmfasmqushk.supabase.co
- Status: ACTIVE_HEALTHY

## Environment Variables
Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://prmaxfslqpmfasmqushk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBybWF4ZnNscXBtZmFzbXF1c2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MjU4NDYsImV4cCI6MjA3MTEwMTg0Nn0.H-6VXcnsDpxCP5GtCUB8P9X7RQTr0YpOwJuvNfY8e0w
# SUPABASE_SERVICE_ROLE_KEY=<to_be_added>
```

## Database Schema
- See `/supabase/migrations/` for database schema definitions
- Run `npm run db:migrate` to apply migrations
- Run `npm run db:seed` to populate with sample data

## Auth Configuration
- Email Magic Link authentication enabled
- Redirect URLs configured for development and production

## Next Steps
1. Apply database migrations
2. Configure Auth settings 
3. Test database connectivity
4. Set up ETL jobs for external data

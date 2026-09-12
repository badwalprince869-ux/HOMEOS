# HomeOS — deploy your own public multi-user site

This is a real web app: anyone can sign up, log in, and their household data is
saved centrally in a database (not on their device).

## 1. Create a free Supabase project (2 minutes)
1. Go to https://supabase.com and sign up / log in.
2. Click "New project". Pick any name and password (save the password somewhere).
3. Once it's created, go to **Project Settings -> API**.
4. Copy the **Project URL** and the **anon public** key.

## 2. Set up the database
1. In Supabase, open **SQL Editor -> New query**.
2. Paste the contents of `supabase/schema.sql` (included in this folder) and click **Run**.
   This creates the tables and locks each user to only see their own data.

## 3. Configure the app with your keys
1. In this project folder, copy `.env.example` to a new file named `.env`.
2. Paste in your Project URL and anon key from step 1.

## 4. Turn off email confirmation (optional, recommended for a demo/pitch)
By default Supabase requires users to click a confirmation email before they can
log in. For a smoother demo: **Authentication -> Providers -> Email -> turn off
"Confirm email"**. You can turn it back on later for the real launch.

## 5. Run it locally to test
```
npm install
npm run dev
```
Open the local URL it prints, sign up, and confirm everything works.

## 6. Deploy to get a public URL
The easiest path:
1. Push this folder to a new GitHub repository.
2. Go to https://vercel.com, sign up with GitHub, click **Add New -> Project**,
   and import that repo.
3. In the Vercel project's **Environment Variables**, add the same two values
   from your `.env` file (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Click **Deploy**. In about a minute you'll get a live URL like
   `https://homeos-yourname.vercel.app` that anyone can visit, sign up on, and use.

You can later attach a custom domain (e.g. `homeos.app`) in the Vercel project
settings if you buy one.

## What's included
- Real sign up / log in (Supabase Auth)
- Each user's appliances, service history, and requests stored in Postgres,
  isolated per user via row-level security
- Same dashboard, appliance passport, maintenance calendar, and service
  request flow as the earlier prototype

## What this MVP intentionally does not include yet (per your own roadmap)
- Automated invoice AI, IoT sensors, in-app payments, technician marketplace
- These are Phase 2+ — the service request currently just logs to the
  `service_requests` table for you to action manually (the "concierge MVP"
  approach from your notes)

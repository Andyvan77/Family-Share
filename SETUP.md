# FamilyShare — Setup Guide

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, name it `familyshare`, pick a region close to you
3. Note your **Project URL** and **anon public key** (found in Settings → API)

## Step 2 — Run the database schema

1. In your Supabase dashboard go to **SQL Editor**
2. Paste the entire contents of `schema.sql` and click **Run**
3. You should see all tables created successfully

## Step 3 — Deploy to Vercel

### Option A — GitHub (recommended)
1. Create a new GitHub repo and push this folder to it
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click **Add New Project** → select your repo → click **Deploy**
4. Done — Vercel will give you a live URL

### Option B — Vercel CLI
```bash
npm i -g vercel
cd "Nintendo rental system"
vercel
```

## Step 4 — First launch

1. Open your Vercel URL (or `index.html` locally)
2. The **Setup screen** appears — enter your Supabase Project URL and anon key
3. Click **Save & Continue**
4. Click **Create Account** → create your family → you're in!

## Step 5 — Invite other families

Share your Vercel URL with the other families. Each family:
1. Opens the URL
2. Clicks **Create Account**
3. Enters their details and either **creates** a new family or **joins** an existing one

---

## Running locally (without Vercel)

Just open `index.html` directly in your browser — it works as a static site with no build step needed. Use a simple server if you hit CORS issues:

```bash
# Python
python -m http.server 3000

# Node
npx serve .
```

Then open `http://localhost:3000`.

---

## Feature overview

| Feature | Where |
|---|---|
| Browse & book assets | Assets tab |
| Calendar schedule | Bookings → Calendar |
| Mark collected / returned | Bookings → My Bookings |
| See where everything is | Tracker tab |
| Customise family colour & avatar | Family tab → Edit Family |
| Add new shared items | Assets → + Add Asset |
| Notifications | 🔔 bell in top bar |

---

## Extending the system

- **More asset types** — add rows to the `categories` table in Supabase
- **Email notifications** — use Supabase Edge Functions + Resend to send emails on new bookings
- **File uploads** — replace photo URLs with Supabase Storage uploads (enable Storage in your Supabase project)
- **Admin dashboard** — use the `role = 'admin'` field to gate management features

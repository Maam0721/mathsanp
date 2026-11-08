# MathSnap

MathSnap is a responsive math-problem library built with Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase, and Anthropic Claude. Organize images by topic, ask for a step-by-step explanation, and follow up with questions in Mongolian by default, with English available.

## Project structure

```text
mathsnap/
├── .env.example
├── next.config.mjs
├── package.json
├── README.md
├── scripts/
│   └── copy-pdf-worker.mjs       # Exposes the local PDF.js worker to the browser
├── supabase/
│   └── migrations/
│       └── 20261107000000_initial_schema.sql
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── chat/route.ts     # Authenticated, rate-limited Claude follow-ups
    │   │   └── solve/route.ts    # Authenticated, rate-limited image solving
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   └── math-snap.tsx
    ├── lib/
    │   ├── rate-limit.ts
    │   ├── validation.ts
    │   └── supabase/
    │       ├── client.ts
    │       └── server.ts
    └── proxy.ts                  # Supabase session refresh
```

## Requirements

- Node.js 20.9 or newer and npm
- A Supabase project
- An Anthropic API key

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the project values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

   `ANTHROPIC_API_KEY` is only read by server routes. Do not prefix it with `NEXT_PUBLIC_` or expose it in browser code.

3. Configure Supabase:

   - In the Supabase SQL Editor, run `supabase/migrations/20261107000000_initial_schema.sql` (or apply it with the Supabase CLI).
   - The migration creates the topic, problem, and solution tables, enables RLS, and creates the private `problems` bucket and owner-folder storage policies.
   - Enable Email provider under **Authentication → Providers**. Configure email confirmation and your site/redirect URLs under **Authentication → URL Configuration** as appropriate.
   - Copy the project URL and anon/public key from **Project Settings → API**.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. To verify types and build a production bundle:

   ```bash
   npm run typecheck
   npm run build
   ```

## Features

- Supabase email signup/login; data and private files are scoped to the signed-in user.
- Create, rename, and delete topics; search, filter, and sort problems; move or delete a problem.
- Drag-and-drop or file-picker uploads for PNG/JPG/PDF, including multiple files. PDF pages are rendered in the browser into PNG images.
- File type and 10 MB size checks in the UI, the storage bucket, and the solve/chat API routes.
- Claude vision solving through authenticated server-only API routes; solutions are persisted and reused until you choose to solve again.
- Follow-up questions send the original image, saved solution, and question to Claude. Follow-up messages are held in the current dialog and are not persisted.
- KaTeX math rendering, dark mode, Mongolian-by-default interface, and English language option.

## Rate limits and production notes

The API currently limits each user to 5 solve requests and 20 follow-up requests per 10-minute window. The in-memory limiter protects a single running Node process, but is instance-local and resets on restart; for horizontally scaled/serverless production deploys, replace it with a shared store such as Upstash Redis.

PDF conversion runs in the browser. The generated PNG pages are subject to the same 10 MB limit before upload. The Supabase bucket accepts only PNG/JPEG and has a 10 MB object limit. Keep the migration's owner-folder storage policies enabled; never make the bucket public.
The `predev` and `prebuild` scripts copy PDF.js's worker to `public/`; this generated file is ignored by Git.

## Deploy to Vercel

1. Push the project to a Git provider and import it in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY` to the Vercel project environment variables for the required environments.
3. Apply the Supabase migration and set the production site URL and auth redirect URLs in Supabase.
4. Deploy. Vercel detects the Next.js app and uses `npm run build`.
5. For multiple concurrent production instances, switch the in-memory rate limiter to a shared backing store.

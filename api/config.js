// GreyTraining — public client configuration (Vercel Node function).
// Hands the app the Supabase URL and the public anon key from the Vercel environment,
// so no key is ever written into the code in the repository.
// The anon key is designed to be public: row level security in supabase/schema.sql
// keeps each user's data private. AI keys are never returned, only which provider is active.
import { aiInfo, env } from '../lib/ai.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const supabaseUrl = env('SUPABASE_URL');
  const supabaseAnonKey = env('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return res.status(200).json({ configured: false });
  const ai = aiInfo();
  return res.status(200).json({
    configured: true,
    supabaseUrl,
    supabaseAnonKey,
    // The coach needs at least one AI key and an allow-list of accounts (see api/coach.js)
    coach: Boolean(ai.configured && env('ALLOWED_EMAILS')),
    aiProvider: ai.primary,
    aiFallback: ai.fallback
  });
}

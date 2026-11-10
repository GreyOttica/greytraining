// GreyTraining — AI providers for the coach (server side only; imported by api/*.js).
//
// Default chain (both free): Groq → Google Gemini.
//   Groq answers first (fast). If it fails (free quota used up, overloaded, slow, any error),
//   the same request goes to Gemini within the time left.
// Paid option: AI_PROVIDER=anthropic uses Claude only.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   GROQ_API_KEY       https://console.groq.com/keys (free, no card)
//   GROQ_MODEL         optional, default "openai/gpt-oss-120b"
//   GEMINI_API_KEY     https://aistudio.google.com → Get API key (free)
//   GEMINI_MODEL       optional, default "gemini-flash-lite-latest" (the fast one)
//   AI_PROVIDER        optional: "groq", "gemini" or "anthropic". "groq" and "gemini" choose which
//                      free provider goes first; the other one, if it has a key, is the fallback.
//   ANTHROPIC_API_KEY  only for AI_PROVIDER=anthropic (paid); ANTHROPIC_MODEL optional

export const env = k => (process.env[k] || '').trim() || undefined;

const KEY = { groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };
const NAME = { groq: 'Groq', gemini: 'Gemini', anthropic: 'Claude' };

/** Providers to try, in order, keeping only those with a key. */
export function chain() {
  const p = (env('AI_PROVIDER') || '').toLowerCase();
  if (p === 'anthropic') return env(KEY.anthropic) ? ['anthropic'] : [];
  const order = p === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  return order.filter(x => env(KEY[x]));
}

/** What the app shows in Profile: which provider answers first, and the missing key if none. */
export function aiInfo() {
  const c = chain();
  const wanted = (env('AI_PROVIDER') || '').toLowerCase() === 'anthropic' ? 'anthropic' : 'groq';
  return { configured: c.length > 0, primary: c[0] || wanted, fallback: c[1] || null, missingKey: c.length ? null : KEY[wanted] };
}

export class CoachError extends Error {
  constructor(message, status = 502, retryable = false) { super(message); this.status = status; this.retryable = retryable; }
}

const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

// ---------- Groq (OpenAI-compatible chat completions, REST) ----------
async function askGroq({ system, messages, contextText, deadline }) {
  const key = env(KEY.groq);
  const model = env('GROQ_MODEL') || 'openai/gpt-oss-120b';
  const last = messages[messages.length - 1];
  const body = {
    model,
    messages: [{ role: 'system', content: system }]
      .concat(messages.slice(0, -1))
      .concat([{ role: 'user', content: `${contextText}\n\n${last.content}` }]),
    // Short coaching answers: low reasoning keeps them fast; only the final text comes back
    reasoning_effort: 'low',
    include_reasoning: false,
    max_completion_tokens: 2048
  };
  for (let attempt = 0; ; attempt++) {
    const left = deadline - Date.now();
    if (left < 3000) throw new CoachError('Groq non ha risposto in tempo.', 504, true);
    let res;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(20000, left)),
        cache: 'no-store'
      });
    } catch (e) {
      throw new CoachError('Groq non raggiungibile o troppo lento.', 504, true);
    }
    if (res.ok) {
      const data = await res.json();
      const choice = data.choices && data.choices[0];
      const reply = String((choice && choice.message && choice.message.content) || '').trim();
      if (!reply) throw new CoachError(`Risposta vuota da Groq (${(choice && choice.finish_reason) || 'nessuna'}).`, 502, true);
      return { reply, model: data.model || model };
    }
    const text = await res.text();
    // One quick retry on a short rate-limit wait; otherwise hand over to the fallback
    const retryAfter = Number(res.headers.get('retry-after'));
    if (res.status === 429 && attempt === 0 && retryAfter > 0 && retryAfter <= 3 && deadline - Date.now() > retryAfter * 1000 + 8000) {
      await wait(retryAfter * 1000);
      continue;
    }
    if (res.status === 429) throw new CoachError('Raggiunto il limite gratuito di Groq. Riprova tra un minuto.', 429, true);
    if (res.status >= 500) throw new CoachError('Groq è sovraccarico in questo momento.', 503, true);
    if (res.status === 401) throw new CoachError('La chiave GROQ_API_KEY non è valida: ricontrollala su Vercel.', 500, true);
    if (res.status === 404) throw new CoachError(`Modello Groq "${model}" non trovato: correggi o togli GROQ_MODEL su Vercel.`, 500, true);
    let message = text.slice(0, 300);
    try { message = JSON.parse(text).error.message || message; } catch {}
    throw new CoachError(`Groq: errore ${res.status}: ${message}`, 502, true);
  }
}

// ---------- Gemini (REST, no SDK — same calls as personalbudget) ----------
const GEMINI_BASE = () => (env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
const GEMINI_DEFAULT = 'gemini-flash-lite-latest';

function retryDelayMs(body) {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  return Math.min(8000, m ? Number(m[1]) * 1000 + 500 : 2000);
}

async function askGemini({ system, messages, contextText, deadline }) {
  const key = env(KEY.gemini);
  const model = env('GEMINI_MODEL') || GEMINI_DEFAULT;
  const contents = messages.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: i === messages.length - 1 ? [{ text: contextText }, { text: m.content }] : [{ text: m.content }]
  }));
  const body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 2048, temperature: 0.4 } };
  for (let attempt = 0; ; attempt++) {
    const left = deadline - Date.now();
    if (left < 3000) throw new CoachError('Gemini non ha risposto in tempo. Riprova tra qualche minuto.', 504, true);
    let res;
    try {
      res = await fetch(`${GEMINI_BASE()}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(30000, left)),
        cache: 'no-store'
      });
    } catch (e) {
      throw new CoachError('Gemini non raggiungibile o troppo lento.', 504, true);
    }
    if (res.ok) {
      const data = await res.json();
      if (data.promptFeedback && data.promptFeedback.blockReason) throw new CoachError('Gemini ha bloccato la domanda. Prova a riformularla.', 422);
      const c = data.candidates && data.candidates[0];
      const parts = (c && c.content && c.content.parts) || [];
      const reply = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('').trim();
      if (!reply) {
        if (c && c.finishReason === 'SAFETY') throw new CoachError('Gemini non ha risposto per i suoi filtri di sicurezza. Prova a riformulare.', 422);
        throw new CoachError(`Risposta vuota da Gemini (${(c && c.finishReason) || 'nessuna risposta'}). Riprova.`, 502, true);
      }
      return { reply, model: data.modelVersion || model };
    }
    const text = await res.text();
    const busy = res.status === 429 || res.status >= 500;
    if (busy && attempt === 0 && deadline - Date.now() > 10000) { await wait(res.status === 429 ? retryDelayMs(text) : 1500); continue; }
    if (res.status >= 500) throw new CoachError('I server di Gemini sono sovraccarichi. Riprova tra qualche minuto.', 503, true);
    if (res.status === 429) throw new CoachError('Raggiunto il limite gratuito di Gemini. Riprova tra un po\'.', 429, true);
    if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(text)) throw new CoachError('La chiave GEMINI_API_KEY non è valida: ricontrollala su Vercel.', 500, true);
    if (res.status === 403) throw new CoachError('Gemini ha rifiutato la chiave (403): usa una chiave di Google AI Studio.', 500, true);
    if (res.status === 404) throw new CoachError(`Modello Gemini "${model}" non trovato: correggi o togli GEMINI_MODEL su Vercel.`, 500, true);
    let message = text.slice(0, 300);
    try { message = JSON.parse(text).error.message || message; } catch {}
    throw new CoachError(`Gemini: errore ${res.status}: ${message}`, 502, true);
  }
}

// ---------- Claude (official SDK, paid; only when AI_PROVIDER=anthropic) ----------
async function askClaude({ system, messages, contextText }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Timeout and retries stay inside the 60 s function limit
  const client = new Anthropic({ timeout: 45000, maxRetries: 1 });
  const model = env('ANTHROPIC_MODEL') || 'claude-opus-5-5';
  const last = messages[messages.length - 1];
  const msgs = messages.slice(0, -1).concat([{ role: 'user', content: [{ type: 'text', text: contextText }, { type: 'text', text: last.content }] }]);
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      // If a safety classifier declines, the API retries on a fallback model in the same call
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: msgs
    });
    if (response.stop_reason === 'refusal') {
      return { reply: 'Su questo non posso aiutarti. Se si tratta di un problema di salute, rivolgiti a un medico o a un fisioterapista.', model: response.model };
    }
    const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!reply) throw new CoachError('Il coach non ha risposto. Riprova.');
    return { reply, model: response.model };
  } catch (error) {
    if (error instanceof CoachError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new CoachError('Chiave Anthropic non valida: controlla ANTHROPIC_API_KEY su Vercel.', 500);
    if (error instanceof Anthropic.RateLimitError) throw new CoachError('Troppe richieste al coach. Riprova tra un minuto.', 429);
    if (error instanceof Anthropic.APIError) { console.error('coach claude', error.status, error.message); throw new CoachError('Il coach non è disponibile in questo momento.'); }
    throw error;
  }
}

const ASK = { groq: askGroq, gemini: askGemini, anthropic: askClaude };

/**
 * Ask the coach. Tries each provider of the chain in order within budgetMs.
 * Returns { reply, provider, model, fallbackFrom? } or throws CoachError.
 */
export async function askCoach({ system, messages, contextText, budgetMs = 50000 }) {
  const order = chain();
  if (!order.length) throw new CoachError(`Coach non configurato: manca ${aiInfo().missingKey} su Vercel.`, 503);
  const deadline = Date.now() + budgetMs;
  let lastError = null;
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    // Leave the fallback at least 12 s of the budget
    const own = i < order.length - 1 ? Math.min(deadline, deadline - 12000) : deadline;
    try {
      const out = await ASK[p]({ system, messages, contextText, deadline: own });
      return Object.assign({ provider: p }, out, i > 0 ? { fallbackFrom: order[0] } : {});
    } catch (e) {
      const err = e instanceof CoachError ? e : new CoachError(`${NAME[p]}: ${e && e.message ? e.message : 'errore'}`, 502, true);
      console.error('coach', p, err.status, err.message);
      lastError = err;
      if (!err.retryable) throw err; // e.g. a safety block: another model would not help
    }
  }
  if (order.length > 1) {
    throw new CoachError(`Coach non disponibile: ${order.map(p => NAME[p]).join(' e ')} sono al limite gratuito o sovraccarichi. Riprova tra qualche minuto.`, lastError.status);
  }
  throw lastError;
}

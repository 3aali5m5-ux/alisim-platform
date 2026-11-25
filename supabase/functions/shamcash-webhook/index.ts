import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Supabase Edge Function: shamcash-webhook
 * Receives Android notification relays (MacroDroid) for ShamCash transfers,
 * authenticates strictly via x-webhook-secret (SHAMCASH_WEBHOOK_SECRET),
 * parses Arabic/English notification text or structured JSON fields,
 * and atomically matches pending top-ups or saves unclaimed transfers with UNIQUE(transaction_id).
 */

const MAX_BODY_BYTES = 16 * 1024; // 16 KB safety cap

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Convert Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII 0-9
 * and normalize Arabic decimal/thousands separators.
 */
function normalizeDigits(input: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  let out = "";
  for (const ch of input) {
    const idxAr = arabicIndic.indexOf(ch);
    if (idxAr !== -1) {
      out += String(idxAr);
      continue;
    }
    const idxFa = persian.indexOf(ch);
    if (idxFa !== -1) {
      out += String(idxFa);
      continue;
    }
    if (ch === "٫") {
      out += ".";
      continue;
    }
    if (ch === "٬") {
      out += ",";
      continue;
    }
    out += ch;
  }
  return out;
}

function parseNumericAmount(rawNum: string): number | null {
  const cleaned = rawNum.trim().replace(/\s+/g, "");
  if (!cleaned) return null;

  // Handle thousands separators like 150,000 or 150,000.50
  let normalized = cleaned;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    // European decimal comma (e.g., 25,50)
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const val = Number(normalized);
  if (!Number.isFinite(val) || val <= 0 || val > 100_000_000) return null;
  return val;
}

function detectCurrency(raw: string): "USD" | "SYP" | "TRY" {
  const text = raw.toUpperCase();
  if (
    /SYP|ل\.?\s*س|ليرة\s*سوري|ليره\s*سوري|سوري/i.test(raw) ||
    text.includes("SYP")
  ) {
    return "SYP";
  }
  if (
    /TRY|TL|₺|ل\.?\s*ت|ليرة\s*تركي|ليره\s*تركي|تركي/i.test(raw) ||
    text.includes("TRY")
  ) {
    return "TRY";
  }
  return "USD";
}

function isLikelyOutgoingOrNonCreditNotification(text: string): boolean {
  // Ignore outgoing transfers sent BY the owner or OTP login alerts
  return /(تم\s+إرسال\s+حوالة|تم\s+ارسال\s+حوالة|قمت\s+بتحويل|رمز\s+التحقق|كود\s+التحقق|OTP\s+code|you\s+sent\s+)/i.test(
    text,
  );
}

interface ParsedShamCashTransfer {
  transactionId: string;
  amount: number;
  currency: "USD" | "SYP" | "TRY";
  rawText: string;
  sourceApp: string;
}

function parseShamCashPayload(payload: Record<string, unknown>): {
  ok: true;
  data: ParsedShamCashTransfer;
} | {
  ok: false;
  code: string;
  error: string;
} {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const rawInput =
    typeof payload.raw_text === "string"
      ? payload.raw_text.trim()
      : typeof payload.text === "string"
      ? payload.text.trim()
      : "";
  const sourceApp =
    typeof payload.app_name === "string" && payload.app_name.trim()
      ? payload.app_name.trim().slice(0, 120)
      : "MacroDroid";

  const combinedRaw = [title, rawInput].filter(Boolean).join(" | ").slice(0, 2000);
  const normText = normalizeDigits(combinedRaw);

  // 1. Direct structured fields (highest priority if provided)
  let txId =
    typeof payload.transaction_id === "string"
      ? normalizeDigits(payload.transaction_id).trim()
      : typeof payload.reference_id === "string"
      ? normalizeDigits(payload.reference_id).trim()
      : typeof payload.referenceId === "string"
      ? normalizeDigits(payload.referenceId).trim()
      : "";

  let amount: number | null = null;
  if (typeof payload.amount === "number" && Number.isFinite(payload.amount) && payload.amount > 0) {
    amount = payload.amount;
  } else if (typeof payload.amount === "string" && payload.amount.trim()) {
    amount = parseNumericAmount(normalizeDigits(payload.amount));
  }

  let currency: "USD" | "SYP" | "TRY" =
    typeof payload.currency === "string" && payload.currency.trim()
      ? detectCurrency(payload.currency)
      : detectCurrency(normText);

  // If raw_text clearly indicates an outgoing transfer or OTP code (and no explicit structured fields), ignore safely
  if (!txId && amount === null && normText && isLikelyOutgoingOrNonCreditNotification(normText)) {
    return {
      ok: false,
      code: "IGNORED_NON_CREDIT_NOTIFICATION",
      error: "Notification is outgoing or non-transfer (OTP/promo); ignored.",
    };
  }

  // 2. Extract Transaction ID from Arabic/English notification text if not supplied directly
  if (!txId && normText) {
    const labeledTxPatterns: RegExp[] = [
      /(?:رقم\s*(?:العملية|الحوالة|التحويل|المرجع|الاشعار|الإشعار|المعاملة)|المرجع|العملية)\s*[:：#\-]?\s*([A-Z0-9][A-Z0-9_-]{3,40})/i,
      /(?:transaction\s*(?:id|no|number|#)?|tx\s*(?:id|#)?|ref(?:erence)?\s*(?:id|no|#)?|order\s*(?:id|#)?)\s*[:：#\-]?\s*([A-Z0-9][A-Z0-9_-]{3,40})/i,
      /#([A-Z0-9][A-Z0-9_-]{4,40})/i,
    ];
    for (const pattern of labeledTxPatterns) {
      const m = normText.match(pattern);
      if (m?.[1]) {
        txId = m[1].trim();
        break;
      }
    }
  }

  // 3. Extract Amount (+ inline currency) from Arabic/English notification text if not supplied directly
  if (amount === null && normText) {
    const amountPatterns: RegExp[] = [
      // e.g. "25.50 USD", "150,000 ل.س", "50 دولار", "500 ليرة تركية"
      /(\d[\d,]*(?:\.\d{1,4})?)\s*(USD|USDT|\$|دولار|د\.?\s*أ|SYP|ل\.?\s*س|ليرة\s*سوري(?:ة)?|ليره\s*سوري(?:ة)?|TRY|TL|₺|ل\.?\s*ت|ليرة\s*تركي(?:ة)?)/i,
      // e.g. "$25.50" or "USD 25.50"
      /(USD|USDT|\$|SYP|TRY|TL|₺)\s*(\d[\d,]*(?:\.\d{1,4})?)/i,
      // e.g. "بمبلغ 25.50" or "بقيمة 100" or "مبلغ: 50"
      /(?:بمبلغ|بقيمة|مبلغ|قيمة|amount|received|استلام|تحويل)\s*[:：]?\s*(\d[\d,]*(?:\.\d{1,4})?)/i,
    ];

    for (const pattern of amountPatterns) {
      const m = normText.match(pattern);
      if (!m) continue;
      // Pattern 2 has currency in group 1 and number in group 2
      const numCandidate = /^\d/.test(m[1]) ? m[1] : m[2];
      const currCandidate = /^\d/.test(m[1]) ? m[2] : m[1];
      const parsed = numCandidate ? parseNumericAmount(numCandidate) : null;
      if (parsed !== null) {
        amount = parsed;
        if (currCandidate) {
          currency = detectCurrency(currCandidate);
        }
        break;
      }
    }
  }

  // Fallback for Transaction ID if text has a standalone 6+ digit numeric code distinct from amount
  if (!txId && normText) {
    const amountDigits = amount !== null ? String(Math.trunc(amount)) : "";
    const candidates = normText.match(/\b[A-Z]{0,4}\d{6,20}\b/gi) || [];
    for (const c of candidates) {
      const clean = c.trim();
      if (clean !== amountDigits && !/^09\d{8}$/.test(clean) && !/^9639\d{8}$/.test(clean)) {
        txId = clean;
        break;
      }
    }
  }

  // Final validation
  const normalizedTxId = txId.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!normalizedTxId || normalizedTxId.length < 4 || normalizedTxId.length > 64) {
    return {
      ok: false,
      code: "MISSING_TRANSACTION_ID",
      error: "Could not extract a valid transaction_id from payload or raw_text.",
    };
  }

  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      code: "MISSING_AMOUNT",
      error: "Could not extract a valid positive amount from payload or raw_text.",
    };
  }

  return {
    ok: true,
    data: {
      transactionId: normalizedTxId,
      amount,
      currency,
      rawText: combinedRaw,
      sourceApp,
    },
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Reject non-POST requests (MacroDroid uses HTTP POST)
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method Not Allowed. Use POST." }, 405);
  }

  // 1. Authenticate caller via x-webhook-secret using constant-time comparison
  const expectedSecret = Deno.env.get("SHAMCASH_WEBHOOK_SECRET")?.trim();
  if (!expectedSecret) {
    return jsonResponse(
      { ok: false, error: "SHAMCASH_WEBHOOK_SECRET is not configured on the server." },
      503,
    );
  }

  const providedSecret = (req.headers.get("x-webhook-secret") || "").trim();
  if (!providedSecret || !timingSafeEqualString(providedSecret, expectedSecret)) {
    return jsonResponse({ ok: false, error: "Unauthorized: invalid x-webhook-secret." }, 401);
  }

  // 2. Guard payload size and parse JSON safely
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Payload too large." }, 413);
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    return jsonResponse({ ok: false, error: "Failed to read request body." }, 400);
  }

  if (new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Payload exceeds 16KB limit." }, 413);
  }

  let payload: Record<string, unknown>;
  try {
    const parsedJson = JSON.parse(bodyText);
    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
      return jsonResponse({ ok: false, error: "JSON body must be an object." }, 400);
    }
    payload = parsedJson as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload." }, 400);
  }

  // 3. Extract transaction_id & amount from structured fields or raw_text
  const parsed = parseShamCashPayload(payload);
  if (!parsed.ok) {
    const statusCode = parsed.code === "IGNORED_NON_CREDIT_NOTIFICATION" ? 202 : 422;
    return jsonResponse({ ok: false, code: parsed.code, error: parsed.error }, statusCode);
  }

  // 4. Execute atomic PostgreSQL RPC using SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: "Supabase service credentials are missing in Edge Function env." },
      503,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("process_shamcash_webhook", {
    p_transaction_id: parsed.data.transactionId,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_raw_text: parsed.data.rawText,
    p_source_app: parsed.data.sourceApp,
  });

  if (error) {
    console.error("[shamcash-webhook] RPC error:", error.message);
    return jsonResponse(
      { ok: false, error: "Database error while processing transfer." },
      500,
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.outcome === "DUPLICATE") {
    return jsonResponse(
      {
        ok: false,
        outcome: "DUPLICATE",
        transaction_id: parsed.data.transactionId,
        message: "Duplicate transaction_id rejected.",
      },
      409,
    );
  }

  return jsonResponse({
    ok: true,
    ...result,
  }, 200);
});

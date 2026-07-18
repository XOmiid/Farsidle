// ------------------------------------------------------------
// Two separate translators, because Supabase returns two
// completely different error shapes depending on the call:
//
// - Auth API calls (signUp, signInWithPassword, verifyOtp,
//   resend, resetPasswordForEmail, updateUser) return an
//   AuthApiError with a reliable `.code` field. Supabase's own
//   docs recommend matching on `.code`, not the message text.
//   https://supabase.com/docs/guides/auth/debugging/error-codes
//
// - Direct table/RPC calls (supabase.from(...).update(...),
//   supabase.rpc(...)) return a PostgREST error instead, shaped
//   around Postgres SQLSTATE codes (e.g. '23505' for a unique
//   violation) in `.code`, with the human-readable detail in
//   `.message`/`.details`.
// ------------------------------------------------------------

const AUTH_CODE_MESSAGES = {
  // Sign up / account existence
  user_already_exists: "این ایمیل قبلاً ثبت‌نام کرده. وارد حساب بشو.",
  email_exists: "این ایمیل قبلاً ثبت‌نام کرده. وارد حساب بشو.",
  signup_disabled: "ثبت‌نام در حال حاضر غیرفعاله.",
  email_provider_disabled: "ثبت‌نام با ایمیل و رمز عبور غیرفعاله.",
  email_address_invalid: "این آدرس ایمیل معتبر نیست.",
  email_address_not_authorized: "امکان ارسال ایمیل به این آدرس نیست.",
  validation_failed: "اطلاعات وارد‌شده معتبر نیست.",

  // Login
  invalid_credentials: "ایمیل یا رمز عبور اشتباهه.",
  email_not_confirmed: "ایمیلت هنوز تایید نشده. صندوق ایمیلت رو چک کن.",
  user_not_found: "کاربری با این مشخصات پیدا نشد.",
  user_banned: "این حساب مسدود شده. با پشتیبانی تماس بگیر.",

  // Password
  weak_password: "رمز عبور خیلی ساده‌ست. یه رمز قوی‌تر با حروف و عدد بیشتر انتخاب کن.",
  same_password: "رمز جدید باید با رمز قبلیت فرق داشته باشه.",
  reauthentication_needed: "برای این کار باید دوباره وارد حساب بشی.",
  reauthentication_not_valid: "کد وارد شده اشتباهه، دوباره امتحان کن.",

  // OTP / codes
  otp_expired: "کد منقضی شده. یه کد جدید بگیر.",
  otp_disabled: "ورود با کد موقتاً غیرفعاله.",

  // Rate limits
  over_email_send_rate_limit: "ایمیل‌های زیادی درخواست دادی. چند دقیقه صبر کن و دوباره امتحان کن.",
  over_request_rate_limit: "درخواست‌های زیادی فرستادی. کمی صبر کن و دوباره امتحان کن.",
  over_sms_send_rate_limit: "پیامک‌های زیادی درخواست دادی. کمی صبر کن.",

  // Sessions
  session_expired: "نشستت منقضی شده. دوباره وارد شو.",
  session_not_found: "نشستت پیدا نشد. دوباره وارد شو.",
  refresh_token_not_found: "نشستت پیدا نشد. دوباره وارد شو.",
  refresh_token_already_used: "این نشست قبلاً استفاده شده. دوباره وارد شو.",

  // Misc / infra
  captcha_failed: "تایید امنیتی ناموفق بود. دوباره امتحان کن.",
  request_timeout: "درخواست بیش از حد طول کشید. دوباره امتحان کن.",
  conflict: "درخواست‌های هم‌زمان زیادی ثبت شد. یه لحظه صبر کن و دوباره امتحان کن.",
  bad_json: "درخواست نامعتبر بود. صفحه رو رفرش کن و دوباره امتحان کن.",
};

// GoTrue (Supabase's auth server) sometimes can't classify a raw
// database error into one of its own codes and returns the generic
// `unexpected_failure` code — this happens for us specifically when
// our signup trigger rejects a duplicate username. We recover the
// specific reason by checking the raw message in just this one case.
function translateUnexpectedFailure(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("database error saving new user") || (m.includes("username") && m.includes("duplicate")))
    return "این نام کاربری قبلاً گرفته شده. یه اسم دیگه امتحان کن.";
  return "مشکلی تو سرور پیش اومد. دوباره امتحان کن.";
}

export function translateAuthError(error) {
  if (!error) return "یه مشکلی پیش اومد، دوباره امتحان کن.";
  const code = error.code;
  const message = error.message || "";

  if (code && AUTH_CODE_MESSAGES[code]) return AUTH_CODE_MESSAGES[code];
  if (code === "unexpected_failure") return translateUnexpectedFailure(message);

  // Fallback for older SDK versions or cases without a .code at all —
  // match on the message text as a last resort.
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "ایمیل یا رمز عبور اشتباهه.";
  if (m.includes("email not confirmed")) return "ایمیلت هنوز تایید نشده. صندوق ایمیلت رو چک کن.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "این ایمیل قبلاً ثبت‌نام کرده. وارد حساب بشو.";
  if (m.includes("password") && (m.includes("6") || m.includes("weak")))
    return "رمز عبور باید حداقل ۶ کاراکتر و به‌قدر کافی قوی باشه.";
  if (m.includes("expired")) return "کد یا لینک منقضی شده. دوباره امتحان کن.";
  if (m.includes("invalid") && (m.includes("otp") || m.includes("token")))
    return "کد وارد شده اشتباهه.";
  if (m.includes("rate limit")) return "درخواست‌های زیادی فرستادی، کمی صبر کن.";
  if (m.includes("database error saving new user")) return translateUnexpectedFailure(message);

  return "یه مشکلی پیش اومد، دوباره امتحان کن.";
}

// Postgres SQLSTATE codes — for direct table/RPC calls
// (supabase.from(...).update(...), supabase.rpc(...)), which return
// a completely different error shape than the Auth API.
export function translatePostgrestError(error, context = {}) {
  if (!error) return "یه مشکلی پیش اومد، دوباره امتحان کن.";
  const code = error.code;
  const text = `${error.message || ""} ${error.details || ""}`.toLowerCase();

  if (code === "23505") {
    // unique_violation
    if (text.includes("username")) return "این نام کاربری قبلاً گرفته شده. یه اسم دیگه امتحان کن.";
    return "این مقدار قبلاً استفاده شده.";
  }
  if (code === "23514") {
    // check_violation
    if (text.includes("username"))
      return "نام کاربری باید بین ۳ تا ۲۰ کاراکتر (حروف فارسی/انگلیسی، عدد یا _) باشه.";
    return "مقدار وارد‌شده معتبر نیست.";
  }
  if (code === "42501") return "اجازه‌ی انجام این کار رو نداری.";
  if (code === "23503") return "این عملیات با اطلاعات مرتبط دیگه‌ای تداخل داره.";
  if (code === "PGRST116")
    return context.notFoundMessage || "موردی پیدا نشد.";

  // Our own RPC functions sometimes raise a plain Persian message
  // directly (e.g. submit_score's "باید وارد حساب بشی") — pass those
  // straight through since they're already meant for display.
  if (error.message && /[\u0600-\u06FF]/.test(error.message)) return error.message;

  return "یه مشکلی پیش اومد، دوباره امتحان کن.";
}
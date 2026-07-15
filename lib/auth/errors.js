export function translateAuthError(message) {
  if (!message) return "یه مشکلی پیش اومد، دوباره امتحان کن.";
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) return "ایمیل یا رمز عبور اشتباهه.";
  if (m.includes("email not confirmed")) return "ایمیلت هنوز تایید نشده. صندوق ایمیلت رو چک کن.";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "این ایمیل قبلاً ثبت‌نام کرده. وارد حساب بشو.";
  if (m.includes("password") && m.includes("6")) return "رمز عبور باید حداقل ۶ کاراکتر باشه.";
  if (m.includes("token has expired") || m.includes("otp_expired"))
    return "کد منقضی شده. یه کد جدید بگیر.";
  if (m.includes("token is invalid") || m.includes("invalid otp") || m.includes("invalid token"))
    return "کد وارد شده اشتباهه.";
  if (m.includes("rate limit")) return "درخواست‌های زیادی فرستادی، کمی صبر کن.";
  if (m.includes("username") && (m.includes("duplicate") || m.includes("unique")))
    return "این نام کاربری قبلاً گرفته شده.";
  if (m.includes("duplicate key") && m.includes("username"))
    return "این نام کاربری قبلاً گرفته شده.";
  if (m.includes("duplicate key")) return "این نام کاربری قبلاً گرفته شده.";
  // Supabase Auth wraps the real Postgres error (e.g. our profiles.username
  // unique-constraint violation) into this generic message before it ever
  // reaches the browser — at signup time this is almost always a taken
  // username, since that's the only thing our signup trigger can reject on.
  if (m.includes("database error saving new user"))
    return "این نام کاربری قبلاً گرفته شده. یه اسم دیگه امتحان کن.";
  if (m.includes("username") || m.includes("check constraint"))
    return "نام کاربری باید بین ۳ تا ۲۰ کاراکتر (حروف، عدد یا _) باشه.";

  return "یه مشکلی پیش اومد، دوباره امتحان کن.";
}

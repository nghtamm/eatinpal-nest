export const OTP_TTL = 300;
export const OTP_MAX_ATTEMPTS = 5;
export const RESET_TTL = 600;

export const OTP_RKEYS = {
  otp: (email: string) => `otp:reset:${email}`,
  attempts: (email: string) => `otp:attempts:${email}`,
  allowed: (email: string) => `otp:reset_allowed:${email}`,
};

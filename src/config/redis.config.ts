export default () => ({
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT),
  redisPassword: process.env.REDIS_PASSWORD,
  otpExpiration: Number(process.env.OTP_EXPIRATION),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS),
  resetWindow: Number(process.env.RESET_WINDOW),
});
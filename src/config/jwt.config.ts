export default () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION,
  jwtEmailSecret: process.env.JWT_EMAIL_SECRET,
  jwtEmailExpiration: process.env.JWT_EMAIL_EXPIRATION,
});

export default () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION,
  jwtRfSecret: process.env.JWT_RF_SECRET,
  jwtRfExpiration: process.env.JWT_RF_EXPIRATION,
});

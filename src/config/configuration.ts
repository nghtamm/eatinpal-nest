import { registerAs } from '@nestjs/config';

export default registerAs('cfg', () => ({
  app: {
    URL: process.env.APP_URL,
  },
  jwt: {
    SECRET: process.env.JWT_SECRET,
    EXPIRATION: process.env.JWT_EXPIRATION,
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION,
    EMAIL_SECRET: process.env.JWT_EMAIL_SECRET,
    EMAIL_EXPIRATION: process.env.JWT_EMAIL_EXPIRATION,
  },
  aws: {
    REGION: process.env.AWS_REGION,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
  },
  redis: {
    HOST: process.env.REDIS_HOST,
    PORT: process.env.REDIS_PORT,
    PASSWORD: process.env.REDIS_PASSWORD,
  },
}));

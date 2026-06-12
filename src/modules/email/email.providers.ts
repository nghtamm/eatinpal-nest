import { SESv2Client } from '@aws-sdk/client-sesv2';
import { ConfigService } from '@nestjs/config';
import { AWS_SES_CLIENT } from './constants/email.constants';

export const SESv2ClientProvider = {
  provide: AWS_SES_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    new SESv2Client({
      region: configService.getOrThrow<string>('cfg.aws.REGION'),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('cfg.aws.ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>(
          'cfg.aws.SECRET_ACCESS_KEY',
        ),
      },
    }),
};

import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AWS_SES_CLIENT } from './constants/email.constants';

@Injectable()
export class EmailService {
  private readonly email: string;
  private readonly appURL: string;

  constructor(
    @Inject(AWS_SES_CLIENT) private readonly sesClient: SESv2Client,
    private readonly configService: ConfigService,
  ) {
    this.email = this.configService.getOrThrow<string>(
      'cfg.aws.SES_FROM_EMAIL',
    );
    this.appURL = this.configService.getOrThrow<string>('cfg.app.URL');
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.appURL}/auth/verify?token=${token}`;

    await this.sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: this.email,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: 'Verify your EatinPal account' },
            Body: {
              Html: {
                Data: `
                  <p>Click the link below to verify your email:</p>
                  <a href="${url}">${url}</a>
                  <p>This link expires in 1 hour.</p>
                `,
              },
            },
          },
        },
      }),
    );
  }

  async sendPasswordResetOTP(to: string, otp: string): Promise<void> {
    await this.sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: this.email,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: 'Reset your EatinPal password' },
            Body: {
              Html: {
                Data: `
                  <p>Use the code below to reset your password:</p>
                  <h2 style="letter-spacing:4px;">${otp}</h2>
                  <p>This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
                `,
              },
            },
          },
        },
      }),
    );
  }
}

import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly sesClient: SESv2Client;
  private readonly email: string;
  private readonly appURL: string;

  constructor(private readonly configService: ConfigService) {
    this.sesClient = new SESv2Client({
      region: this.configService.getOrThrow<string>('awsRegion'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('awsAccessKeyID'),
        secretAccessKey: this.configService.getOrThrow<string>('awsSecretAccessKey'),
      },
    });
    this.email = this.configService.getOrThrow<string>('sesFromEmail');
    this.appURL = this.configService.getOrThrow<string>('APP_URL');
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.appURL}/auth/verify?token=${token}`;

    await this.sesClient.send(new SendEmailCommand({
      FromEmailAddress: this.email,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: 'Verify your EatinPal account'},
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
    }));
  }
}

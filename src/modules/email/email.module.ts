import { Module } from '@nestjs/common';
import { SESv2ClientProvider } from './email.providers';
import { EmailService } from './email.service';

@Module({
  providers: [SESv2ClientProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}

import { Global, Module } from '@nestjs/common';
import { SESv2ClientProvider } from './email.providers';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [SESv2ClientProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}

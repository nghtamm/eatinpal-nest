import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class MagicLinkDTO {
  @Expose({ name: 'verification_token' })
  @IsString()
  @IsNotEmpty()
  verificationToken: string;
}

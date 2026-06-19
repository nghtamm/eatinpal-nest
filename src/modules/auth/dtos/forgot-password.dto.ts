import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { NormalizeText } from 'src/common/utils/string.util';

export class ForgotPasswordDTO {
  @Transform(({ value }) => NormalizeText(value))
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

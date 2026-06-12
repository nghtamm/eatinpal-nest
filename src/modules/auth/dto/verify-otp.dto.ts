import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOTPDTO {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}

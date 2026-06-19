import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { ForgotPasswordDTO } from './dtos/forgot-password.dto';
import { RegisterDTO } from './dtos/register.dto';
import { ResetPasswordDTO } from './dtos/reset-password.dto';
import { VerifyOTPDTO } from './dtos/verify-otp.dto';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { SignupService } from './services/signup.service';
import { TokenService } from './services/token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly signupService: SignupService,
    private readonly tokenService: TokenService,
  ) {}

  register(dto: RegisterDTO) {
    return this.signupService.register(dto);
  }

  login(user: User) {
    return this.sessionService.login(user);
  }

  logout(userID: number, refreshToken?: string) {
    return this.sessionService.logout(userID, refreshToken);
  }

  refresh(refreshToken: string) {
    return this.tokenService.refresh(refreshToken);
  }

  resend(email: string) {
    return this.signupService.resend(email);
  }

  verify(verificationToken: string) {
    return this.signupService.verify(verificationToken);
  }

  magicLink(verificationToken: string) {
    return this.signupService.magicLink(verificationToken);
  }

  requestReset(dto: ForgotPasswordDTO) {
    return this.passwordService.requestReset(dto);
  }

  verifyOTP(dto: VerifyOTPDTO) {
    return this.passwordService.verifyOTP(dto);
  }

  resetPassword(dto: ResetPasswordDTO) {
    return this.passwordService.resetPassword(dto);
  }
}

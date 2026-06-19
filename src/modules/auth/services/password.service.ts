import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { TResponse } from '../../../common/types/response.type';
import {
  BcryptHash,
  GenerateNumericOTP,
  SHA256,
} from '../../../common/utils/cryptography.util';
import { EmailService } from '../../email/email.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RKEYS,
  OTP_TTL,
  RESET_TTL,
} from '../constants/auth.constants';
import { ForgotPasswordDTO } from '../dtos/forgot-password.dto';
import { ResetPasswordDTO } from '../dtos/reset-password.dto';
import { VerifyOTPDTO } from '../dtos/verify-otp.dto';
import { TokenService } from './token.service';

@Injectable()
export class PasswordService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async requestReset(dto: ForgotPasswordDTO): Promise<TResponse> {
    const email = dto.email;
    const user = await this.usersService.findOneByEmail(email);

    if (!user || !user.passwordHash || !user.isActive) {
      throw new NotFoundException(
        'Could not find your account. Please check your email and try again',
      );
    }

    const otp = GenerateNumericOTP(6);
    await this.redisService.setEX(OTP_RKEYS.otp(email), SHA256(otp), OTP_TTL);
    await this.redisService.delete(OTP_RKEYS.attempts(email));
    await this.emailService.sendPasswordResetOTP(user.email, otp);

    return {
      message: 'A 6-digit code has been sent to your email',
    };
  }

  async verifyOTP(dto: VerifyOTPDTO): Promise<TResponse> {
    const email = dto.email;

    const attempts = await this.redisService.get(OTP_RKEYS.attempts(email));
    if (attempts && Number(attempts) >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException({
        message: 'Too many attempts. Please try again later',
        errorCode: 'OTP_LOCKED',
      });
    }

    const stored = await this.redisService.get(OTP_RKEYS.otp(email));
    if (!stored) {
      throw new UnauthorizedException({
        message: 'This code is invalid',
        errorCode: 'OTP_INVALID',
      });
    }

    const otp = SHA256(dto.otp);
    const match = crypto.timingSafeEqual(Buffer.from(otp), Buffer.from(stored));
    if (!match) {
      await this.redisService.incrEX(OTP_RKEYS.attempts(email), OTP_TTL);
      throw new UnauthorizedException({
        message: 'This code is invalid',
        errorCode: 'OTP_INVALID',
      });
    }

    await this.redisService.delete(OTP_RKEYS.otp(email));
    await this.redisService.delete(OTP_RKEYS.attempts(email));
    await this.redisService.setEX(OTP_RKEYS.allowed(email), '1', RESET_TTL);

    return { message: 'Code verified' };
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<TResponse> {
    const email = dto.email;

    const allowed = await this.redisService.get(OTP_RKEYS.allowed(email));
    if (!allowed) {
      throw new ForbiddenException(
        'There was an error processing your request. Please try again later',
      );
    }

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      await this.redisService.delete(OTP_RKEYS.allowed(email));
      throw new UnauthorizedException(
        'There was an error processing your request. Please try again later',
      );
    }

    const hash = await BcryptHash(dto.newPassword);
    await this.usersService.updatePasswordByID(user.id, hash);

    if (!user.emailVerified) {
      await this.usersService.updateEmailVerifiedByID(user.id, true);
    }

    await this.redisService.delete(OTP_RKEYS.allowed(email));
    await this.tokenService.revoke(user.id);

    return { message: 'Your password has been reset successfully' };
  }
}

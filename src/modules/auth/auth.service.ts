import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuthProvider } from '../../common/constants/auth-provider.enum';
import {
  BcryptCompare,
  BcryptHash,
  GenerateNumericOTP,
  SHA256,
} from '../../common/utils/cryptography.util';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDTO } from './dto/forgot-password.dto';
import { RegisterDTO } from './dto/register.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { VerifyOTPDTO } from './dto/verify-otp.dto';
import { RefreshToken } from './entities/refresh-token.entity';

const OTP_EXPIRATION = 300;
const OTP_MAX_ATTEMPTS = 5;
const RESET_WINDOW = 600;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDTO): Promise<any> {
    const hash = await BcryptHash(dto.password);
    const user = await this.usersService.createOne(
      {
        email: dto.email,
        passwordHash: hash,
        name: dto.name,
      },
      AuthProvider.LOCAL,
    );

    const token = await this.generateVerificationToken(user);
    await this.sendVerificationEmail(user, token);

    return { message: 'Account registration successful' };
  }

  async login(user: User): Promise<any> {
    const tokens = await this.generateCredentialsToken(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, tokens };
  }

  async logout(userID: number, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenRepository.update(
        {
          userID: userID,
          tokenHash: SHA256(refreshToken),
          revokedAt: IsNull(),
        },
        { revokedAt: new Date() },
      );
    } else {
      await this.refreshTokenRepository.update(
        { userID: userID, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }
  }

  async refresh(userID: number, refreshToken: string): Promise<any> {
    const user = await this.usersService.findOneByID(userID);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const stored = await this.refreshTokenRepository.findOne({
      where: {
        userID: user.id,
        tokenHash: SHA256(refreshToken),
        revokedAt: IsNull(),
      },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.refreshTokenRepository.update(stored.id, {
      revokedAt: new Date(),
    });

    const tokens = await this.generateCredentialsToken(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  private async storeRefreshToken(
    userID: number,
    token: string,
  ): Promise<void> {
    const tokenSHA = SHA256(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      userID: userID,
      tokenHash: tokenSHA,
      expiresAt: expiresAt,
    });
    await this.refreshTokenRepository.save(refreshToken);
  }

  private async generateCredentialsToken(user: User): Promise<any> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('cfg.jwt.REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow('cfg.jwt.REFRESH_EXPIRATION'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async validateLocal(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const match = await BcryptCompare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your account before logging in',
      );
    }

    return user;
  }

  async validateJWT(payload: { sub: number; email: string }): Promise<User> {
    const user = await this.usersService.findOneByID(payload.sub);
    if (!user) {
      throw new UnauthorizedException('This account no longer exists');
    } else if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }
    return user;
  }

  private async generateVerificationToken(user: User): Promise<string> {
    return await this.jwtService.signAsync(
      { sub: user.id, email: user.email, purpose: 'verification' },
      {
        secret: this.configService.getOrThrow<string>('cfg.jwt.EMAIL_SECRET'),
        expiresIn: this.configService.getOrThrow('cfg.jwt.EMAIL_EXPIRATION'),
      },
    );
  }

  private async sendVerificationEmail(
    user: User,
    verificationToken: string,
  ): Promise<void> {
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
    );
  }

  async resend(email: string): Promise<any> {
    let token: string | undefined;
    const user = await this.usersService.findOneByEmail(email);

    if (user && !user.emailVerified) {
      token = await this.generateVerificationToken(user);
      await this.sendVerificationEmail(user, token);
    }

    return { message: 'A verification mail has been sent to your inbox' };
  }

  async verify(verificationToken: string): Promise<any> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(verificationToken, {
        secret: this.configService.getOrThrow<string>('cfg.jwt.EMAIL_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.purpose !== 'verification') {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findOneByID(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (user.emailVerified) {
      return { message: 'This account is already verified' };
    }

    await this.usersService.updateEmailVerifiedByID(user.id, true);
    return { message: 'Account verification successful' };
  }

  async magicLink(verificationToken: string): Promise<any> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(verificationToken, {
        secret: this.configService.getOrThrow<string>('cfg.jwt.EMAIL_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.purpose !== 'verification') {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findOneByID(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    } else if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your account before logging in',
      );
    }

    return this.login(user);
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private otpKey(email: string): string {
    return `otp:reset:${email}`;
  }

  private otpAttemptsKey(email: string): string {
    return `otp:attempts:${email}`;
  }

  private resetAllowedKey(email: string): string {
    return `reset:allowed:${email}`;
  }

  async requestReset(dto: ForgotPasswordDTO): Promise<any> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findOneByEmail(email);

    if (user && user.passwordHash && user.isActive) {
      const otp = GenerateNumericOTP(6);
      await this.redisService.setEX(
        this.otpKey(email),
        SHA256(otp),
        OTP_EXPIRATION,
      );
      await this.redisService.delete(this.otpAttemptsKey(email));
      await this.emailService.sendPasswordResetOTP(user.email, otp);
    }

    return {
      message: 'If an account exists for that email, an OTP has been sent',
    };
  }

  async verifyOTP(dto: VerifyOTPDTO): Promise<any> {
    const email = this.normalizeEmail(dto.email);

    const attemptsRaw = await this.redisService.get(this.otpAttemptsKey(email));
    if (attemptsRaw && Number(attemptsRaw) >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException(
        'Too many attempts, please request a new code',
      );
    }

    const stored = await this.redisService.get(this.otpKey(email));
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const provided = SHA256(dto.otp);
    const match = crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(stored),
    );
    if (!match) {
      await this.redisService.incrEX(
        this.otpAttemptsKey(email),
        OTP_EXPIRATION,
      );
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.redisService.delete(this.otpKey(email));
    await this.redisService.delete(this.otpAttemptsKey(email));
    await this.redisService.setEX(
      this.resetAllowedKey(email),
      '1',
      RESET_WINDOW,
    );

    return { message: 'Code verified' };
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<any> {
    const email = this.normalizeEmail(dto.email);

    const allowed = await this.redisService.get(this.resetAllowedKey(email));
    if (!allowed) {
      throw new ForbiddenException(
        'Reset session expired, please verify again',
      );
    }

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      await this.redisService.delete(this.resetAllowedKey(email));
      throw new UnauthorizedException('Invalid or expired code');
    }

    const hash = await BcryptHash(dto.newPassword);
    await this.usersService.updatePasswordByID(user.id, hash);
    await this.redisService.delete(this.resetAllowedKey(email));

    await this.logout(user.id);

    return { message: 'Password has been reset' };
  }
}

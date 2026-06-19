import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from '../../../common/enums/auth-provider.enum';
import { TResponse } from '../../../common/types/response.type';
import { BcryptHash } from '../../../common/utils/cryptography.util';
import { EmailService } from '../../email/email.service';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { RegisterDTO } from '../dtos/register.dto';
import { IAuthResponse } from '../interfaces/auth-response.interface';
import { IVerificationTokenPayload } from '../interfaces/jwt-payload.interface';
import { SessionService } from './session.service';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDTO): Promise<TResponse> {
    const hash = await BcryptHash(dto.password);
    const user = await this.usersService.createOne(
      {
        email: dto.email,
        passwordHash: hash,
        name: dto.name,
      },
      AuthProvider.LOCAL,
    );

    try {
      const token = await this.generateVerificationToken(user);
      await this.emailService.sendVerificationEmail(user.email, token);
    } catch (error) {
      this.logger.error(
        `[ERROR] | There was an error sending the verification email to ${user.email}`,
        (error as Error).stack,
      );
    }

    return {
      message: 'Account registered. A verification mail has been sent to your inbox',
    };
  }

  async resend(email: string): Promise<TResponse> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && !user.emailVerified) {
      const token = await this.generateVerificationToken(user);
      await this.emailService.sendVerificationEmail(user.email, token);
    }

    return { message: 'A verification mail has been sent to your inbox' };
  }

  async verify(verificationToken: string): Promise<TResponse> {
    const user = await this.verifyVerificationToken(verificationToken);
    if (user.emailVerified) {
      return { message: 'This account is already verified' };
    }

    await this.usersService.updateEmailVerifiedByID(user.id, true);
    return { message: 'Account verification successful' };
  }

  async magicLink(
    verificationToken: string,
  ): Promise<TResponse<IAuthResponse>> {
    const user = await this.verifyVerificationToken(verificationToken);
    if (!user.emailVerified) {
      throw new ForbiddenException({
        message: 'Please verify your account before logging in',
        errorCode: 'EMAIL_NOT_VERIFIED',
      });
    } else if (!user.isActive) {
      throw new ForbiddenException({
        message: 'This account has been deactivated',
        errorCode: 'ACCOUNT_DEACTIVATED',
      });
    }

    return this.sessionService.login(user);
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

  private async verifyVerificationToken(
    verificationToken: string,
  ): Promise<User> {
    let payload: IVerificationTokenPayload;
    
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

    return user;
  }
}

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthProvider } from '../../common/constants/auth-provider.enum';
import {
  BcryptCompare,
  BcryptHash,
  SHA256,
} from '../../common/utils/cryptography.util';
import { EmailService } from '../email/email.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDTO } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

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

    return { message: 'Registration successful', verificationToken: token };
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
    deviceName?: string,
    ipAddress?: string,
  ): Promise<void> {
    const tokenSHA = SHA256(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      userID: userID,
      tokenHash: tokenSHA,
      deviceName: deviceName,
      ipAddress: ipAddress,
      expiresAt: expiresAt,
    });
    await this.refreshTokenRepository.save(refreshToken);
  }

  private async generateCredentialsToken(user: User): Promise<any> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwtRefreshSecret'),
        expiresIn: this.configService.get('jwtRefreshExpiration'),
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
        secret: this.configService.get<string>('jwtEmailSecret'),
        expiresIn: this.configService.get('jwtEmailExpiration'),
      },
    );
  }

  private sendVerificationEmail = async (
    user: User,
    verificationToken: string,
  ): Promise<void> =>
    this.emailService.sendVerificationEmail(user.email, verificationToken);

  async resendVerification(email: string): Promise<any> {
    let token: string | undefined;
    const user = await this.usersService.findOneByEmail(email);

    if (user && !user.emailVerified) {
      token = await this.generateVerificationToken(user);
      await this.sendVerificationEmail(user, token);
    }

    return {
      message: 'A verification mail has been sent to your inbox',
      verificationToken: token,
    };
  }

  async verify(verificationToken: string): Promise<any> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(verificationToken, {
        secret: this.configService.get<string>('jwtEmailSecret'),
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
      return { message: 'Email is already verified', verified: true };
    }

    await this.usersService.updateEmailVerifiedByID(user.id, true);
    return { message: 'Verification successful', verified: false };
  }

  async verifiedLogin(verificationToken: string): Promise<any> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(verificationToken, {
        secret: this.configService.getOrThrow<string>('jwtEmailSecret'),
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
}

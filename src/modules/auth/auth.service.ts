import { Injectable, UnauthorizedException } from '@nestjs/common';
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
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDTO } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDTO): Promise<any> {
    const hash = await BcryptHash(dto.password);
    await this.usersService.create(
      {
        email: dto.email,
        passwordHash: hash,
        name: dto.name,
      },
      AuthProvider.LOCAL,
    );

    return { message: 'Registration successful!' };
  }

  async login(user: User): Promise<any> {
    const tokens = await this.generateTokenPair(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, tokens };
  }

  async logout(userID: number, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const stored = await this.refreshTokenRepository.findOne({
        where: {
          userID,
          tokenHash: SHA256(refreshToken),
          revokedAt: IsNull(),
        },
      });
      if (!stored) {
        throw new UnauthorizedException('Invalid refresh token!');
      }

      await this.refreshTokenRepository.update(stored.id, {
        revokedAt: new Date(),
      });
    } else {
      await this.refreshTokenRepository.update(
        { userID, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }
  }

  async refresh(userID: number, refreshToken: string): Promise<any> {
    const user = await this.usersService.findOneByID(userID);
    if (!user) {
      throw new UnauthorizedException('User not found!');
    }

    const stored = await this.refreshTokenRepository.findOne({
      where: {
        userID: user.id,
        tokenHash: SHA256(refreshToken),
        revokedAt: IsNull(),
      },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token may be expired, revoked or invalid!',
      );
    }

    await this.refreshTokenRepository.update(stored.id, {
      revokedAt: new Date(),
    });

    const tokens = await this.generateTokenPair(user);
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

  private async generateTokenPair(user: User): Promise<any> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwtRfSecret'),
        expiresIn: this.configService.get('jwtRfExpiration'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async validateLocal(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect!');
    }

    const match = await BcryptCompare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Email or password is incorrect!');
    }

    return user;
  }

  async validateJWT(payload: { sub: number; email: string }): Promise<User> {
    const user = await this.usersService.findOneByID(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { AuthProvider } from 'src/common/constants/auth-provider.enum';
import { BcryptHash, SHA256 } from 'src/common/utils/cryptography.util';
import { IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthResponseDTO } from './dto/response/auth-response.dto';
import { RegisterDTO } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserAuthProvider } from './entities/user-auth-provider.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(UserAuthProvider)
    private readonly authProviderRepository: Repository<UserAuthProvider>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDTO): Promise<string> {
    const hash = await BcryptHash(dto.password);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash: hash,
      name: dto.name,
    });

    const provider = this.authProviderRepository.create({
      user: user,
      provider: AuthProvider.LOCAL,
    });
    await this.authProviderRepository.save(provider);

    return 'Registration successful!';
  }

  async login(user: User): Promise<AuthResponseDTO> {
    const tokens = await this.signTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return plainToInstance(
      AuthResponseDTO,
      { user: user, tokens: tokens },
      { excludeExtraneousValues: true },
    );
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

  async refresh(
    userID: number,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
      throw new UnauthorizedException('Invalid refresh token!');
    }

    await this.refreshTokenRepository.update(stored.id, {
      revokedAt: new Date(),
    });

    const tokens = await this.signTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  private async saveRefreshToken(
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

  private async signTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
}

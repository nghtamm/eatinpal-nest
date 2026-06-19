import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as ms from 'ms';
import { IsNull, Repository } from 'typeorm';
import { SHA256 } from '../../../common/utils/cryptography.util';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { RefreshToken } from '../entities/refresh-token.entity';
import { IAuthTokens } from '../interfaces/auth-response.interface';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async initSession(user: User): Promise<IAuthTokens> {
    const familyID = crypto.randomUUID();
    const tokens = await this.generateAuthTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken, familyID);

    return tokens;
  }

  async refresh(refreshToken: string): Promise<IAuthTokens> {
    let payload: IJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('cfg.jwt.REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findOneByID(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    } else if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    const stored = await this.refreshTokenRepository.findOne({
      where: { userID: user.id, tokenHash: SHA256(refreshToken) },
    });
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired token');
    } else if (stored.revokedAt) {
      await this.refreshTokenRepository.update(
        { familyID: stored.familyID, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Invalid or expired token');
    } else if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const revoked = await this.refreshTokenRepository.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (revoked.affected === 0) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const tokens = await this.generateAuthTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken, stored.familyID);

    return tokens;
  }

  async revoke(userID: number, refreshToken?: string): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        userID: userID,
        revokedAt: IsNull(),
        ...(refreshToken && { tokenHash: SHA256(refreshToken) }),
      },
      { revokedAt: new Date() },
    );
  }

  private async generateAuthTokens(user: User): Promise<IAuthTokens> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        jwtid: crypto.randomUUID(),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('cfg.jwt.REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow('cfg.jwt.REFRESH_EXPIRATION'),
        jwtid: crypto.randomUUID(),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userID: number,
    refreshToken: string,
    familyID: string,
  ): Promise<void> {
    const tokenSHA = SHA256(refreshToken);
    const expiresAt = new Date();
    const ttl = ms(
      this.configService.getOrThrow<string>('cfg.jwt.REFRESH_EXPIRATION'),
    );
    expiresAt.setTime(expiresAt.getTime() + ttl);

    const record = this.refreshTokenRepository.create({
      userID: userID,
      tokenHash: tokenSHA,
      familyID: familyID,
      expiresAt: expiresAt,
    });
    await this.refreshTokenRepository.save(record);
  }
}

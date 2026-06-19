import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TResponse } from '../../../common/types/response.type';
import { BcryptCompare } from '../../../common/utils/cryptography.util';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { IAuthResponse } from '../interfaces/auth-response.interface';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenService } from './token.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async login(user: User): Promise<TResponse<IAuthResponse>> {
    const tokens = await this.tokenService.initSession(user);

    return { user, tokens };
  }

  async logout(userID: number, refreshToken?: string): Promise<void> {
    await this.tokenService.revoke(userID, refreshToken);
  }

  async validateLocal(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
    } else if (!user.passwordHash) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const match = await BcryptCompare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

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

    return user;
  }

  async validateJWT(payload: IJwtPayload): Promise<User> {
    const user = await this.usersService.findOneByID(payload.sub);
    if (!user) {
      throw new UnauthorizedException(
        'There was an error processing your request',
      );
    } else if (!user.isActive) {
      throw new ForbiddenException({
        message: 'This account has been deactivated',
        errorCode: 'ACCOUNT_DEACTIVATED',
      });
    }

    return user;
  }
}

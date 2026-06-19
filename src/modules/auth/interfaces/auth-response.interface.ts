import { User } from 'src/modules/users/entities/user.entity';

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResponse {
  user: User;
  tokens: IAuthTokens;
}

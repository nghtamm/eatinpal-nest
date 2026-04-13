import { Expose, Type } from 'class-transformer';

class UserResponse {
  @Expose({ name: 'uuid' })
  id: number;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose({ name: 'avatarURL' })
  avatarUrl: string | null;
}

class TokensResponse {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;
}

export class AuthResponseDTO {
  @Expose()
  @Type(() => UserResponse)
  user: UserResponse;

  @Expose()
  @Type(() => TokensResponse)
  tokens: TokensResponse;
}

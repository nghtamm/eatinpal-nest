import { Expose, Type } from 'class-transformer';

class UserDTO {
  @Expose({ name: 'uuid' })
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose({ name: 'avatarURL' })
  avatarUrl: string | null;

  @Expose()
  emailVerified: boolean;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

class TokensDTO {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;
}

export class AuthResponseDTO {
  @Expose()
  @Type(() => UserDTO)
  user: UserDTO;

  @Expose()
  @Type(() => TokensDTO)
  tokens: TokensDTO;
}

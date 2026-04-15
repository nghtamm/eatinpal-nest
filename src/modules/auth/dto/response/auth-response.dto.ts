import { Expose, Type } from 'class-transformer';

class User {
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

class Tokens {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;
}

export class AuthResponseDTO {
  @Expose()
  @Type(() => User)
  user: User;

  @Expose()
  @Type(() => Tokens)
  tokens: Tokens;
}

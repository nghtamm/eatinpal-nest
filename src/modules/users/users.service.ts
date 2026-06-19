import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserAuthProvider } from '../auth/entities/user-auth-provider.entity';
import { User } from './entities/user.entity';
import { ICreateUser } from './interfaces/create-user.interface';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  async findOneByID(id: number): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async createOne(
    options: ICreateUser,
    authProvider: AuthProvider,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const exists = await manager.exists(User, {
        where: { email: options.email },
      });
      if (exists) {
        throw new ConflictException('This email is already registered');
      }

      const user = manager.create(User, options);
      const saved = await manager.save(user);

      const provider = manager.create(UserAuthProvider, {
        user: saved,
        provider: authProvider,
      });
      await manager.save(provider);

      return saved;
    });
  }

  async updateEmailVerifiedByID(
    id: number,
    emailVerified: boolean,
  ): Promise<void> {
    await this.userRepository.update(id, { emailVerified });
  }

  async updatePasswordByID(id: number, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, { passwordHash });
  }
}

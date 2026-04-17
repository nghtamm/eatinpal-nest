import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthProvider } from '../../common/constants/auth-provider.enum';
import { UserAuthProvider } from '../auth/entities/user-auth-provider.entity';
import { CreateUserDTO } from './dto/create-user.dto';
import { User } from './entities/user.entity';

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
    dto: CreateUserDTO,
    authProvider: AuthProvider,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const exists = await manager.exists(User, {
        where: { email: dto.email },
      });
      if (exists) {
        throw new ConflictException('Email is already in use');
      }

      const user = manager.create(User, dto);
      const saved = await manager.save(user);

      const provider = manager.create(UserAuthProvider, {
        user: saved,
        provider: authProvider,
      });
      await manager.save(provider);

      return saved;
    });
  }

  async updateEmailVerifiedByID(id: number, verified: boolean): Promise<void> {
    await this.userRepository.update(id, { emailVerified: verified });
    return;
  }
}

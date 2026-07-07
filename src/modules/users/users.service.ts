import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserAuthProvider } from '../auth/entities/user-auth-provider.entity';
import { OnboardingDTO } from './dtos/onboarding.dto';
import { SetNutritionGoalDTO } from './dtos/set-nutrition-goal.dto';
import { UpdateProfileDTO } from './dtos/update-profile.dto';
import { NutritionGoal } from './entities/nutrition-goal.entity';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { ICreateUser } from './interfaces/create-user.interface';
import { calculateNutritionGoal } from './utils/nutrition.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,

    @InjectRepository(NutritionGoal)
    private readonly goalRepository: Repository<NutritionGoal>,
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

  // ----- Profile -----

  async getOrCreateProfile(userID: number): Promise<UserProfile> {
    const existing = await this.profileRepository.findOneBy({ userID });
    if (existing) return existing;
    return this.profileRepository.save(
      this.profileRepository.create({ userID }),
    );
  }

  async updateProfile(
    userID: number,
    dto: UpdateProfileDTO,
  ): Promise<UserProfile> {
    const profile = await this.getOrCreateProfile(userID);
    // dto chỉ chứa field client gửi → partial update
    return this.profileRepository.save(Object.assign(profile, dto));
  }

  async onboarding(
    userID: number,
    dto: OnboardingDTO,
  ): Promise<{ profile: UserProfile; goal: NutritionGoal | null }> {
    const { autoCreatePlan, ...profileFields } = dto;
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(UserProfile, { userID });
      const profile = await manager.save(
        manager.merge<UserProfile>(
          UserProfile,
          existing ?? manager.create(UserProfile, { userID }),
          profileFields,
        ),
      );

      let goal: NutritionGoal | null = null;
      if (autoCreatePlan) {
        goal = await this.upsertGoal(manager, userID, {
          ...calculateNutritionGoal(profile),
          isCustom: false,
        });
      }

      return { profile, goal };
    });
  }

  // ----- Nutrition goal -----

  async getNutritionGoal(userID: number): Promise<NutritionGoal | null> {
    // null nếu chưa set → frontend tự xử "chưa có plan", không cần bắt 404
    return this.goalRepository.findOneBy({ userID });
  }

  async setNutritionGoal(
    userID: number,
    dto: SetNutritionGoalDTO,
  ): Promise<NutritionGoal> {
    return this.upsertGoal(this.goalRepository.manager, userID, {
      ...dto,
      isCustom: true,
    });
  }

  async recalculateNutritionGoal(userID: number): Promise<NutritionGoal> {
    const profile = await this.profileRepository.findOneBy({ userID });
    if (!profile || !this.isProfileComplete(profile)) {
      throw new BadRequestException(
        'Complete your profile before generating a plan',
      );
    }
    return this.upsertGoal(this.goalRepository.manager, userID, {
      ...calculateNutritionGoal(profile),
      isCustom: false,
    });
  }

  private async upsertGoal(
    manager: EntityManager,
    userID: number,
    fields: Partial<NutritionGoal>,
  ): Promise<NutritionGoal> {
    const existing = await manager.findOneBy(NutritionGoal, { userID });
    return manager.save(
      manager.merge<NutritionGoal>(
        NutritionGoal,
        existing ?? manager.create(NutritionGoal, { userID }),
        fields,
      ),
    );
  }

  private isProfileComplete(p: UserProfile): boolean {
    return (
      p.gender != null &&
      p.dateOfBirth != null &&
      p.heightCm != null &&
      p.weightKg != null &&
      p.activityLevel != null &&
      p.goal != null
    );
  }
}

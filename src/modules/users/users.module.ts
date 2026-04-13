import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NutritionGoal } from './entities/nutrition-goal.entity';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { WeightLog } from './entities/weight-log.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, NutritionGoal, WeightLog]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ActivityLevel } from '../../../common/enums/activity-level.enum';
import { Gender } from '../../../common/enums/gender.enum';
import { UserGoal } from '../../../common/enums/user-goal.enum';

export class UpdateProfileDTO {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Expose({ name: 'date_of_birth' })
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @Expose({ name: 'height_cm' })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(300)
  heightCm?: number;

  @Expose({ name: 'weight_kg' })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(500)
  weightKg?: number;

  @Expose({ name: 'activity_level' })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsEnum(UserGoal)
  goal?: UserGoal;

  @IsOptional()
  @IsString()
  timezone?: string;
}

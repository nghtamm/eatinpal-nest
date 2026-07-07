import { Expose } from 'class-transformer';
import { ActivityLevel } from '../../../../common/enums/activity-level.enum';
import { Gender } from '../../../../common/enums/gender.enum';
import { UserGoal } from '../../../../common/enums/user-goal.enum';

export class ProfileResponseDTO {
  @Expose()
  gender: Gender | null;

  @Expose()
  dateOfBirth: string | null;

  @Expose()
  heightCm: number | null;

  @Expose()
  weightKg: number | null;

  @Expose()
  activityLevel: ActivityLevel | null;

  @Expose()
  goal: UserGoal | null;

  @Expose()
  timezone: string;
}

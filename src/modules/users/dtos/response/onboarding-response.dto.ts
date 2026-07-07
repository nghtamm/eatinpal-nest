import { Expose, Type } from 'class-transformer';
import { NutritionGoalResponseDTO } from './nutrition-goal-response.dto';
import { ProfileResponseDTO } from './profile-response.dto';

export class OnboardingResponseDTO {
  @Expose()
  @Type(() => ProfileResponseDTO)
  profile: ProfileResponseDTO;

  @Expose()
  @Type(() => NutritionGoalResponseDTO)
  goal: NutritionGoalResponseDTO | null;
}

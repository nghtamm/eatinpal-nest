import { Expose } from 'class-transformer';

export class NutritionGoalResponseDTO {
  @Expose()
  calories: number;

  @Expose()
  protein: number | null;

  @Expose()
  fat: number | null;

  @Expose()
  carbs: number | null;

  @Expose()
  isCustom: boolean;
}

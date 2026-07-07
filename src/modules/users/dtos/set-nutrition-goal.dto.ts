import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SetNutritionGoalDTO {
  @IsNumber()
  @Min(500)
  @Max(10000)
  calories: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  protein?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  fat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  carbs?: number;
}

import { ActivityLevel } from '../../../common/enums/activity-level.enum';
import { Gender } from '../../../common/enums/gender.enum';
import { UserGoal } from '../../../common/enums/user-goal.enum';

// ponytail: hệ số/heuristic dinh dưỡng — đây là "núm chỉnh", tinh chỉnh sau khi có feedback thật
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.ACTIVE]: 1.725,
  [ActivityLevel.VERY_ACTIVE]: 1.9,
};

const GOAL_ADJUSTMENT: Record<UserGoal, number> = {
  [UserGoal.LOSE]: -500,
  [UserGoal.MAINTAIN]: 0,
  [UserGoal.GAIN]: 300,
};

export interface NutritionInput {
  gender: Gender;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: UserGoal;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export function calculateAge(dateOfBirth: string, now = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function calculateNutritionGoal(
  input: NutritionInput,
): NutritionTargets {
  // cột decimal của TypeORM đọc ra dạng string → coerce về number cho chắc
  const weightKg = Number(input.weightKg);
  const heightCm = Number(input.heightCm);
  const age = calculateAge(input.dateOfBirth);

  // 1. BMR (Mifflin-St Jeor); gender OTHER dùng công thức nữ làm mặc định an toàn
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = input.gender === Gender.MALE ? base + 5 : base - 161;

  // 2. TDEE + điều chỉnh theo mục tiêu
  const tdee = bmr * ACTIVITY_MULTIPLIER[input.activityLevel];
  const calories = Math.round(tdee + GOAL_ADJUSTMENT[input.goal]);

  // 3. Chia macro: protein 1.8g/kg, fat 25% kcal, carbs phần còn lại (1g P/C=4kcal, 1g F=9kcal)
  const protein = Math.round(1.8 * weightKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, fat, carbs };
}

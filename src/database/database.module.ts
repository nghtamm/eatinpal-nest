import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomMealEntry } from './entities/custom-meal-entry.entity';
import { DailyLog } from './entities/daily-log.entity';
import { FoodCategory } from './entities/food-category.entity';
import { FoodItemNutrient } from './entities/food-item-nutrient.entity';
import { FoodItem } from './entities/food-item.entity';
import { MealEntry } from './entities/meal-entry.entity';
import { Meal } from './entities/meal.entity';
import { Nutrient } from './entities/nutrient.entity';
import { ServingSize } from './entities/serving-size.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyLog,
      Meal,
      MealEntry,
      CustomMealEntry,
      FoodItem,
      FoodCategory,
      FoodItemNutrient,
      Nutrient,
      ServingSize,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

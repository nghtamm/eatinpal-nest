import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Meal } from './meal.entity';
import { FoodItem } from './food-item.entity';
import { ServingSize } from './serving-size.entity';
import { CustomMealEntry } from './custom-meal-entry.entity';

@Entity('meal_entries')
export class MealEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'meal_id' })
  mealID: number;

  @ManyToOne(() => Meal, (m) => m.mealEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meal_id' })
  meal: Meal;

  @Column({ nullable: true, name: 'food_item_id' })
  foodItemID: number;

  @ManyToOne(() => FoodItem, { nullable: true })
  @JoinColumn({ name: 'food_item_id' })
  foodItem: FoodItem;

  @Column({ nullable: true, name: 'serving_size_id' })
  servingSizeID: number;

  @ManyToOne(() => ServingSize, { nullable: true })
  @JoinColumn({ name: 'serving_size_id' })
  servingSize: ServingSize;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  quantityGrams: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => CustomMealEntry, (c) => c.mealEntry)
  customMealEntry: CustomMealEntry;
}

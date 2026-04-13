import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MealEntry } from './meal-entry.entity';

@Entity('custom_meal_entries')
export class CustomMealEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, name: 'meal_entry_id' })
  mealEntryID: number;

  @OneToOne(() => MealEntry, (me) => me.customMealEntry, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meal_entry_id' })
  mealEntry: MealEntry;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  calories: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  protein: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  fat: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  carbs: number;
}

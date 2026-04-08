import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { MealType } from '../../common/constants';
import { DailyLog } from './daily-log.entity';
import { MealEntry } from './meal-entry.entity';

@Entity('meals')
export class Meal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'uuidv7()' })
  uuid: string;

  @Index()
  @Column({ name: 'daily_log_id' })
  dailyLogID: number;

  @ManyToOne(() => DailyLog, (dl) => dl.meals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'daily_log_id' })
  dailyLog: DailyLog;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: MealType })
  mealType: MealType;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => MealEntry, (me) => me.meal)
  mealEntries: MealEntry[];
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('nutrition_goals')
export class NutritionGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, name: 'user_id' })
  userID: number;

  @OneToOne(() => User, (u) => u.nutritionGoal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  calories: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  protein: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  fat: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  carbs: number;

  @Column({ type: 'boolean', default: false })
  isCustom: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

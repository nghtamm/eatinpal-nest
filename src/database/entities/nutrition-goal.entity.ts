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

  @Column({ unique: true })
  userId: number;

  @OneToOne(() => User, (u) => u.nutritionGoal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  calories: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  proteinG: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  fatG: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  carbsG: number;

  @Column({ type: 'boolean', default: false })
  isCustom: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

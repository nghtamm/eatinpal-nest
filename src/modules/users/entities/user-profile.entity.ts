import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ActivityLevel } from '../../../common/constants/activity-level.enum';
import { Gender } from '../../../common/constants/gender.enum';
import { UserGoal } from '../../../common/constants/user-goal.enum';
import { User } from './user.entity';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, name: 'user_id' })
  userID: number;

  @OneToOne(() => User, (u) => u.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  heightCm: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  weightKg: number;

  @Column({ type: 'enum', enum: ActivityLevel, nullable: true })
  activityLevel: ActivityLevel;

  @Column({ type: 'enum', enum: UserGoal, nullable: true })
  goal: UserGoal;

  @Column({ type: 'varchar', length: 50, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

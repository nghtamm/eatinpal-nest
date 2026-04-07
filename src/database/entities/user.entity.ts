import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserAuthProvider } from './user-auth-provider.entity';
import { RefreshToken } from './refresh-token.entity';
import { UserProfile } from './user-profile.entity';
import { NutritionGoal } from './nutrition-goal.entity';
import { WeightLog } from './weight-log.entity';
import { DailyLog } from './daily-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'uuidv7()' })
  uuid: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => UserAuthProvider, (p) => p.user)
  authProviders: UserAuthProvider[];

  @OneToMany(() => RefreshToken, (t) => t.user)
  refreshTokens: RefreshToken[];

  @OneToOne(() => UserProfile, (p) => p.user)
  profile: UserProfile;

  @OneToOne(() => NutritionGoal, (g) => g.user)
  nutritionGoal: NutritionGoal;

  @OneToMany(() => WeightLog, (w) => w.user)
  weightLogs: WeightLog[];

  @OneToMany(() => DailyLog, (d) => d.user)
  dailyLogs: DailyLog[];
}

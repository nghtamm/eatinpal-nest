import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Meal } from './meal.entity';

@Entity('daily_logs')
@Unique(['userID', 'date'])
export class DailyLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'uuidv7()' })
  uuid: string;

  @Index()
  @Column({ name: 'user_id' })
  userID: number;

  @ManyToOne(() => User, (u) => u.dailyLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Meal, (m) => m.dailyLog)
  meals: Meal[];
}

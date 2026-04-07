import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Meal } from './meal.entity';

@Entity('daily_logs')
@Unique(['userId', 'date'])
export class DailyLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  uuid: string;

  @Index()
  @Column()
  userId: number;

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

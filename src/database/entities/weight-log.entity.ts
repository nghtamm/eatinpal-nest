import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('weight_logs')
@Unique(['userId', 'loggedAt'])
export class WeightLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, (u) => u.weightLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 5, scale: 1 })
  weightKg: number;

  @Column({ type: 'date' })
  loggedAt: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('weight_logs')
@Unique(['userID', 'loggedAt'])
export class WeightLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  userID: number;

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

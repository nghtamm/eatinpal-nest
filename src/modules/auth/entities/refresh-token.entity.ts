import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  userID: number;

  @ManyToOne(() => User, (u) => u.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, unique: true })
  tokenHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceName: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

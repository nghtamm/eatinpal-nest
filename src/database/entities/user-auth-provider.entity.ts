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
import { AuthProvider } from '../../common/constants';
import { User } from './user.entity';

@Entity('user_auth_providers')
@Unique(['userId', 'provider'])
@Unique(['provider', 'providerId'])
export class UserAuthProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, (u) => u.authProviders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

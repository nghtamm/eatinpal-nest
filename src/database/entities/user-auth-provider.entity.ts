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
@Unique(['userID', 'provider'])
@Unique(['provider', 'providerID'])
export class UserAuthProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  userID: number;

  @ManyToOne(() => User, (u) => u.authProviders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'provider_id' })
  providerID: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

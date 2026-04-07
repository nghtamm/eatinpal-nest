import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FoodItem } from './food-item.entity';

@Entity('serving_sizes')
export class ServingSize {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  foodItemId: number;

  @ManyToOne(() => FoodItem, (item) => item.servingSizes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'food_item_id' })
  foodItem: FoodItem;

  @Column({ type: 'varchar', length: 100 })
  nameVi: string;

  @Column({ type: 'varchar', length: 100 })
  nameEn: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grams: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

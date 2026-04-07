import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FoodItemType } from '../../common/constants';
import { FoodItem } from './food-item.entity';

@Entity('food_categories')
export class FoodCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nameVi: string;

  @Column({ type: 'varchar', length: 255 })
  nameEn: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'enum', enum: FoodItemType })
  type: FoodItemType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FoodItem, (item) => item.category)
  foodItems: FoodItem[];
}

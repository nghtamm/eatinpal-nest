import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FoodItemType } from '../../common/constants/food-item-type.enum';
import { FoodItem } from './food-item.entity';

@Entity('food_categories')
export class FoodCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, name: 'name_vi' })
  nameVI: string;

  @Column({ type: 'varchar', length: 255, name: 'name_en' })
  nameEN: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'enum', enum: FoodItemType })
  type: FoodItemType;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'source_id' })
  sourceID: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FoodItem, (item) => item.category)
  foodItems: FoodItem[];
}

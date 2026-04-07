import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { FoodItemType } from '../../common/constants';
import { FoodCategory } from './food-category.entity';
import { FoodItemNutrient } from './food-item-nutrient.entity';
import { ServingSize } from './serving-size.entity';

@Entity('food_items')
export class FoodItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'uuidv7()' })
  uuid: string;

  @Column({ type: 'enum', enum: FoodItemType })
  type: FoodItemType;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  nameVi: string;

  @Column({ type: 'varchar', length: 255 })
  nameEn: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nameAscii: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  energy: number;

  @Index()
  @Column()
  categoryId: number;

  @ManyToOne(() => FoodCategory, (cat) => cat.foodItems)
  @JoinColumn({ name: 'category_id' })
  category: FoodCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FoodItemNutrient, (fin) => fin.foodItem)
  foodItemNutrients: FoodItemNutrient[];

  @OneToMany(() => ServingSize, (ss) => ss.foodItem)
  servingSizes: ServingSize[];
}

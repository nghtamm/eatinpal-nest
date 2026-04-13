import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FoodItemType } from '../../common/constants/food-item-type.enum';
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

  @Column({ type: 'varchar', length: 255, name: 'name_vi' })
  nameVI: string;

  @Column({ type: 'varchar', length: 255, name: 'name_en' })
  nameEN: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'name_ascii' })
  nameASCII: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
  imageURL: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  energy: number;

  @Index()
  @Column({ name: 'category_id' })
  categoryID: number;

  @ManyToOne(() => FoodCategory, (cat) => cat.foodItems)
  @JoinColumn({ name: 'category_id' })
  category: FoodCategory;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'source_id' })
  sourceID: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FoodItemNutrient, (fin) => fin.foodItem)
  foodItemNutrients: FoodItemNutrient[];

  @OneToMany(() => ServingSize, (ss) => ss.foodItem)
  servingSizes: ServingSize[];
}

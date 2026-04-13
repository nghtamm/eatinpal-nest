import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FoodItem } from './food-item.entity';
import { Nutrient } from './nutrient.entity';

@Entity('food_item_nutrients')
@Unique(['foodItemID', 'nutrientID'])
export class FoodItemNutrient {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'food_item_id' })
  foodItemID: number;

  @ManyToOne(() => FoodItem, (item) => item.foodItemNutrients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'food_item_id' })
  foodItem: FoodItem;

  @Column({ name: 'nutrient_id' })
  nutrientID: number;

  @ManyToOne(() => Nutrient, (n) => n.foodItemNutrients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'nutrient_id' })
  nutrient: Nutrient;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  value: number;
}

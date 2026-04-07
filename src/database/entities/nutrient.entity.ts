import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FoodItemNutrient } from './food-item-nutrient.entity';

@Entity('nutrients')
export class Nutrient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nameVi: string;

  @Column({ type: 'varchar', length: 255 })
  nameEn: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FoodItemNutrient, (fin) => fin.nutrient)
  foodItemNutrients: FoodItemNutrient[];
}

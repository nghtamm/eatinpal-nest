import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { FoodCategory } from '../entities/food-category.entity';
import { FoodItem } from '../entities/food-item.entity';
import { Nutrient } from '../entities/nutrient.entity';
import { FoodItemNutrient } from '../entities/food-item-nutrient.entity';
import { FoodItemType } from '../../common/constants';
import { getProcessedData } from 'eatinpal-crawler';
import type { Food, Meal, FoodCategory as CrawlerFoodCat, MealCategory } from 'eatinpal-crawler';

function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function seed() {
  console.log('Loading processed data from eatinpal-crawler...');
  const data = getProcessedData();

  console.log(`Loaded: ${data.foods.length} foods, ${data.meals.length} meals`);
  console.log(`Categories: ${data.foodCategories.length} food, ${data.mealCategories.length} meal`);

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  console.log('Database connected');

  await dataSource.transaction(async (manager) => {
    // --- 1. Seed food categories (type = ingredient) ---
    console.log('Seeding food categories...');
    const categoryMap = new Map<string, number>();

    for (const cat of data.foodCategories) {
      const slug = slugify(cat.nameVI);
      const saved = await manager.save(FoodCategory, manager.create(FoodCategory, {
        nameVi: cat.nameVI,
        nameEn: cat.nameEN,
        slug: `ingredient-${slug}`,
        type: FoodItemType.INGREDIENT,
      }));
      categoryMap.set(cat.nameVI, saved.id);
    }

    // --- 2. Seed meal categories (type = dish) ---
    console.log('Seeding meal categories...');

    for (const cat of data.mealCategories) {
      const slug = cat.slug || slugify(cat.nameVI);
      const saved = await manager.save(FoodCategory, manager.create(FoodCategory, {
        nameVi: cat.nameVI,
        nameEn: cat.nameEN,
        slug: `dish-${slug}`,
        type: FoodItemType.DISH,
        sourceId: cat.sourceID,
      }));
      categoryMap.set(cat.sourceID, saved.id);
    }
    console.log(`  Saved ${categoryMap.size} categories`);

    // --- 3. Collect and seed unique nutrients ---
    console.log('Collecting nutrients...');
    const nutrientMap = new Map<string, number>();

    for (const food of data.foods) {
      for (const n of food.nutrients) {
        const key = slugify(n.nameVI);
        if (!nutrientMap.has(key)) {
          const saved = await manager.save(Nutrient, manager.create(Nutrient, {
            nameVi: n.nameVI,
            nameEn: n.nameEN,
            key,
            unit: n.unit,
          }));
          nutrientMap.set(key, saved.id);
        }
      }
    }

    for (const meal of data.meals) {
      for (const n of meal.nutrients) {
        const key = n.key || slugify(n.nameVI);
        if (!nutrientMap.has(key)) {
          const saved = await manager.save(Nutrient, manager.create(Nutrient, {
            nameVi: n.nameVI,
            nameEn: n.nameEN,
            key,
            unit: n.unit,
          }));
          nutrientMap.set(key, saved.id);
        }
      }
    }
    console.log(`  Saved ${nutrientMap.size} unique nutrients`);

    // --- 4. Seed food items (ingredients) ---
    console.log('Seeding food items (ingredients)...');

    for (const food of data.foods) {
      const catId = categoryMap.get(food.categoryVI);
      if (!catId) {
        console.warn(`  Skipping food "${food.nameVI}": category not found`);
        continue;
      }

      const savedItem = await manager.save(FoodItem, manager.create(FoodItem, {
        type: FoodItemType.INGREDIENT,
        code: food.code,
        nameVi: food.nameVI,
        nameEn: food.nameEN,
        energy: food.energy ?? undefined,
        categoryId: catId,
        sourceId: food.sourceID,
      }));

      const finEntities = food.nutrients
        .map((n) => {
          const key = slugify(n.nameVI);
          const nutrientId = nutrientMap.get(key);
          if (!nutrientId) return null;
          return manager.create(FoodItemNutrient, {
            foodItemId: savedItem.id,
            nutrientId,
            value: n.value ?? undefined,
          });
        })
        .filter((e): e is FoodItemNutrient => e !== null);

      if (finEntities.length > 0) {
        await manager.save(FoodItemNutrient, finEntities);
      }
    }
    console.log(`  Saved ${data.foods.length} ingredients`);

    // --- 5. Seed food items (dishes) ---
    console.log('Seeding food items (dishes)...');

    for (const meal of data.meals) {
      const catId = categoryMap.get(meal.categorySourceID);
      if (!catId) {
        console.warn(`  Skipping meal "${meal.nameVI}": category not found`);
        continue;
      }

      const savedItem = await manager.save(FoodItem, manager.create(FoodItem, {
        type: FoodItemType.DISH,
        code: meal.code,
        nameVi: meal.nameVI,
        nameEn: meal.nameEN,
        nameAscii: meal.nameAscii || undefined,
        description: meal.description || undefined,
        imageUrl: meal.image || undefined,
        energy: meal.energy ?? undefined,
        categoryId: catId,
        sourceId: meal.sourceID,
      }));

      const finEntities = meal.nutrients
        .map((n) => {
          const key = n.key || slugify(n.nameVI);
          const nutrientId = nutrientMap.get(key);
          if (!nutrientId) return null;
          return manager.create(FoodItemNutrient, {
            foodItemId: savedItem.id,
            nutrientId,
            value: n.value ?? undefined,
          });
        })
        .filter((e): e is FoodItemNutrient => e !== null);

      if (finEntities.length > 0) {
        await manager.save(FoodItemNutrient, finEntities);
      }
    }
    console.log(`  Saved ${data.meals.length} dishes`);
  });

  console.log('Seed completed successfully!');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

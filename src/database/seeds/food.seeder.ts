import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { FoodCategory } from '../entities/food-category.entity';
import { FoodItem } from '../entities/food-item.entity';
import { Nutrient } from '../entities/nutrient.entity';
import { FoodItemNutrient } from '../entities/food-item-nutrient.entity';
import { FoodItemType } from '../../common/constants';
import { getProcessedData } from 'eatinpal-crawler';

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
  console.log('[EATINPAL-CRAWLER] Fetching processed data...');
  const data = getProcessedData();

  console.log(
    `[EATINPAL-CRAWLER] Fetched: ${data.foods.length} foods, ${data.meals.length} meals`,
  );
  console.log(
    `[EATINPAL-CRAWLER] Categories: ${data.foodCategories.length} food, ${data.mealCategories.length} meal`,
  );

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  console.log('[POSTGRESQL] Database connected!');

  await dataSource.transaction(async (manager) => {
    // 1 - Seed food categories
    console.log('[SEED] Seeding food categories...');
    const categoryMap = new Map<string, number>();

    for (const cat of data.foodCategories) {
      const slug = slugify(cat.nameVI);
      const saved = await manager.save(
        FoodCategory,
        manager.create(FoodCategory, {
          nameVI: cat.nameVI,
          nameEN: cat.nameEN,
          slug: `ingredient-${slug}`,
          type: FoodItemType.INGREDIENT,
        }),
      );
      categoryMap.set(cat.nameVI, saved.id);
    }

    // 2 - Seed meal categories
    console.log('[SEED] Seeding meal categories...');
    for (const cat of data.mealCategories) {
      const slug = cat.slug || slugify(cat.nameVI);
      const saved = await manager.save(
        FoodCategory,
        manager.create(FoodCategory, {
          nameVI: cat.nameVI,
          nameEN: cat.nameEN,
          slug: `dish-${slug}`,
          type: FoodItemType.DISH,
          sourceID: cat.sourceID,
        }),
      );
      categoryMap.set(cat.sourceID, saved.id);
    }
    console.log(`[OK] ${categoryMap.size} categories`);

    // 3 - Seed nutrients
    console.log('[SEED] Seeding nutrients...');
    const nutrientMap = new Map<string, number>();

    // 3.1 - Collect unique nutrients from foods
    for (const food of data.foods) {
      for (const n of food.nutrients) {
        const key = slugify(n.nameVI);
        if (!key || !n.unit || nutrientMap.has(key)) continue;
        const saved = await manager.save(
          Nutrient,
          manager.create(Nutrient, {
            nameVI: n.nameVI,
            nameEN: n.nameEN,
            key,
            unit: n.unit,
          }),
        );
        nutrientMap.set(key, saved.id);
      }
    }

    // 3.2 - Collect unique nutrients from meals
    for (const meal of data.meals) {
      for (const n of meal.nutrients) {
        const key = n.key || slugify(n.nameVI);
        if (!key || !n.unit || nutrientMap.has(key)) continue;
        const saved = await manager.save(
          Nutrient,
          manager.create(Nutrient, {
            nameVI: n.nameVI,
            nameEN: n.nameEN,
            key,
            unit: n.unit,
          }),
        );
        nutrientMap.set(key, saved.id);
      }
    }
    console.log(`[OK] ${nutrientMap.size} unique nutrients`);

    // 4.1 - Seed food items
    console.log('[SEED] Seeding food items...');
    for (const food of data.foods) {
      const catID = categoryMap.get(food.categoryVI);
      if (!catID) {
        console.warn(
          `[WARN] Skipping food "${food.nameVI}": category not found`,
        );
        continue;
      }

      const saved = await manager.save(
        FoodItem,
        manager.create(FoodItem, {
          type: FoodItemType.INGREDIENT,
          code: food.code,
          nameVI: food.nameVI,
          nameEN: food.nameEN || '',
          energy: food.energy ?? undefined,
          categoryID: catID,
          sourceID: food.sourceID,
        }),
      );

      const foodSetIDs = new Set<number>();
      const foodItemNutrient = food.nutrients
        .map((n) => {
          const key = slugify(n.nameVI);
          const nutrientID = nutrientMap.get(key);
          if (!nutrientID || foodSetIDs.has(nutrientID)) return null;
          foodSetIDs.add(nutrientID);
          return manager.create(FoodItemNutrient, {
            foodItemID: saved.id,
            nutrientID: nutrientID,
            value: n.value ?? undefined,
          });
        })
        .filter((e): e is FoodItemNutrient => e !== null);

      if (foodItemNutrient.length > 0) {
        await manager.save(FoodItemNutrient, foodItemNutrient);
      }
    }
    console.log(`[OK] ${data.foods.length} ingredients`);

    // 4.2 - Seed meal items
    for (const meal of data.meals) {
      const catID = categoryMap.get(meal.categorySourceID);
      if (!catID) {
        console.warn(
          `[WARN] Skipping meal "${meal.nameVI}": category not found`,
        );
        continue;
      }

      const saved = await manager.save(
        FoodItem,
        manager.create(FoodItem, {
          type: FoodItemType.DISH,
          code: meal.code,
          nameVI: meal.nameVI,
          nameEN: meal.nameEN || '',
          nameASCII: meal.nameAscii || undefined,
          description: meal.description || undefined,
          energy: meal.energy ?? undefined,
          categoryID: catID,
          sourceID: meal.sourceID,
        }),
      );

      const mealSetIDs = new Set<number>();
      const mealItemNutrients = meal.nutrients
        .map((n) => {
          const key = n.key || slugify(n.nameVI);
          const nutrientID = nutrientMap.get(key);
          if (!nutrientID || mealSetIDs.has(nutrientID)) return null;
          mealSetIDs.add(nutrientID);
          return manager.create(FoodItemNutrient, {
            foodItemID: saved.id,
            nutrientID: nutrientID,
            value: n.value ?? undefined,
          });
        })
        .filter((e): e is FoodItemNutrient => e !== null);

      if (mealItemNutrients.length > 0) {
        await manager.save(FoodItemNutrient, mealItemNutrients);
      }
    }
    console.log(`[OK] ${data.meals.length} dishes`);
  });

  console.log('[OK] Seed completed successfully!');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('[WARN] Seed failed:', err);
  process.exit(1);
});

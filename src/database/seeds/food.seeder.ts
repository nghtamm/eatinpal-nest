import { CrawlAllData, ProcessAllData } from 'eatinpal-crawler';
import { FoodItemType } from '../../common/constants/food-item-type.enum';
import PostgresDataSource from '../data-source';
import { FoodCategory } from '../entities/food-category.entity';
import { FoodItemNutrient } from '../entities/food-item-nutrient.entity';
import { FoodItem } from '../entities/food-item.entity';
import { Nutrient } from '../entities/nutrient.entity';

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
  console.log('[EATINPAL-CRAWLER] Crawling data from source...');
  const raw = await CrawlAllData();
  const data = ProcessAllData(raw.foods, raw.meals);

  console.log(
    `[EATINPAL-CRAWLER] Fetched: ${data.foods.length} foods, ${data.meals.length} meals`,
  );
  console.log(
    `[EATINPAL-CRAWLER] Categories: ${data.foodCategories.length} food, ${data.mealCategories.length} meal`,
  );

  await PostgresDataSource.initialize();
  console.log('[POSTGRESQL] Database connected!');

  try {
    await PostgresDataSource.transaction(async (manager) => {
      const existing = await manager.count(FoodCategory);
      if (existing > 0) {
        console.log(
          `[SKIP] Database already has ${existing} categories — aborting seed`,
        );
        return;
      }

      const ingredientCategoryMap = new Map<string, number>();
      const dishCategoryMap = new Map<string, number>();

      // 1 - Seed food (ingredient) categories
      console.log('[SEED] Seeding food categories...');
      const ingredientCategories = data.foodCategories.map((cat) =>
        manager.create(FoodCategory, {
          nameVI: cat.nameVI,
          nameEN: cat.nameEN || '',
          slug: `ingredient-${slugify(cat.nameVI)}`,
          type: FoodItemType.INGREDIENT,
        }),
      );

      const savedIngredientCats = await manager.save(
        FoodCategory,
        ingredientCategories,
      );
      savedIngredientCats.forEach((cat, i) => {
        ingredientCategoryMap.set(data.foodCategories[i].nameVI, cat.id);
      });

      // 2 - Seed meal (dish) categories
      console.log('[SEED] Seeding meal categories...');
      const dishCategories = data.mealCategories.map((cat) =>
        manager.create(FoodCategory, {
          nameVI: cat.nameVI,
          nameEN: cat.nameEN || '',
          slug: `dish-${cat.slug || slugify(cat.nameVI)}`,
          type: FoodItemType.DISH,
          sourceID: cat.sourceID,
        }),
      );

      const savedDishCats = await manager.save(FoodCategory, dishCategories);
      savedDishCats.forEach((cat, i) => {
        dishCategoryMap.set(data.mealCategories[i].sourceID, cat.id);
      });

      console.log(
        `[OK] ${ingredientCategoryMap.size + dishCategoryMap.size} categories`,
      );

      // 3 - Seed nutrients (unique by key)
      console.log('[SEED] Seeding nutrients...');
      const nutrientMap = new Map<string, number>();
      const nutrients: Nutrient[] = [];
      const duplicated = new Set<string>();

      const collect = (n: {
        nameVI: string;
        nameEN: string;
        unit?: string | null;
        key?: string | null;
      }) => {
        const key = n.key || slugify(n.nameVI);
        if (!key) return;

        if (!n.unit) {
          console.warn(`[WARN] Nutrient '${n.nameVI}' skipped: missing unit`);
          return;
        }

        if (duplicated.has(key)) return;
        duplicated.add(key);

        nutrients.push(
          manager.create(Nutrient, {
            nameVI: n.nameVI,
            nameEN: n.nameEN || '',
            key,
            unit: n.unit,
          }),
        );
      };

      for (const food of data.foods) {
        for (const n of food.nutrients) collect(n);
      }
      for (const meal of data.meals) {
        for (const n of meal.nutrients) collect(n);
      }

      const savedNutrients = await manager.save(Nutrient, nutrients);
      savedNutrients.forEach((nutr) => nutrientMap.set(nutr.key, nutr.id));

      console.log(`[OK] ${nutrientMap.size} unique nutrients`);

      // 4.1 - Seed food (ingredient) items
      console.log('[SEED] Seeding food items...');
      const ingredientEntities: FoodItem[] = [];
      const ingredientSources: (typeof data.foods)[number][] = [];
      const ingredientNutrients: FoodItemNutrient[] = [];

      for (const food of data.foods) {
        const catID = ingredientCategoryMap.get(food.categoryVI);
        if (!catID) {
          console.warn(
            `[WARN] Skipping food '${food.nameVI}': category not found`,
          );
          continue;
        }

        ingredientEntities.push(
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
        ingredientSources.push(food);
      }

      const savedIngredients = await manager.save(
        FoodItem,
        ingredientEntities,
        { chunk: 200 },
      );
      savedIngredients.forEach((item, i) => {
        const food = ingredientSources[i];
        const seen = new Set<number>();

        for (const n of food.nutrients) {
          const nutrientID = nutrientMap.get(slugify(n.nameVI));
          if (!nutrientID || seen.has(nutrientID)) continue;
          seen.add(nutrientID);

          ingredientNutrients.push(
            manager.create(FoodItemNutrient, {
              foodItemID: item.id,
              nutrientID,
              value: n.value ?? undefined,
            }),
          );
        }
      });

      if (ingredientNutrients.length > 0) {
        await manager.save(
          FoodItemNutrient,
          ingredientNutrients,
          { chunk: 1000 },
        );
      }

      console.log(`[OK] ${savedIngredients.length} ingredients`);

      // 4.2 - Seed meal (dish) items
      console.log('[SEED] Seeding meal items...');
      const dishEntities: FoodItem[] = [];
      const dishSources: (typeof data.meals)[number][] = [];
      const dishNutrients: FoodItemNutrient[] = [];

      for (const meal of data.meals) {
        const catID = dishCategoryMap.get(meal.categorySourceID);
        if (!catID) {
          console.warn(
            `[WARN] Skipping meal '${meal.nameVI}': category not found`,
          );
          continue;
        }

        dishEntities.push(
          manager.create(FoodItem, {
            type: FoodItemType.DISH,
            code: meal.code,
            nameVI: meal.nameVI,
            nameEN: meal.nameEN || '',
            nameASCII: meal.nameASCII || undefined,
            description: meal.description || undefined,
            energy: meal.energy ?? undefined,
            categoryID: catID,
            sourceID: meal.sourceID,
          }),
        );
        dishSources.push(meal);
      }

      const savedDishes = await manager.save(
        FoodItem,
        dishEntities,
        { chunk: 200 },
      );
      savedDishes.forEach((item, i) => {
        const meal = dishSources[i];
        const seen = new Set<number>();

        for (const n of meal.nutrients) {
          const nutrientID = nutrientMap.get(n.key || slugify(n.nameVI));
          if (!nutrientID || seen.has(nutrientID)) continue;
          seen.add(nutrientID);
          
          dishNutrients.push(
            manager.create(FoodItemNutrient, {
              foodItemID: item.id,
              nutrientID,
              value: n.value ?? undefined,
            }),
          );
        }
      });

      if (dishNutrients.length > 0) {
        await manager.save(
          FoodItemNutrient,
          dishNutrients,
          { chunk: 1000 },
        );
      }

      console.log(`[OK] ${savedDishes.length} dishes`);
    });

    console.log('[OK] Seed completed successfully!');
  } finally {
    await PostgresDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('[ERROR] Seed failed:', err);
  process.exit(1);
});

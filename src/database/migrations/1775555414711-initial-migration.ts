import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1775555414711 implements MigrationInterface {
  name = 'InitialMigration1775555414711';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(
      `CREATE TYPE "public"."user_auth_providers_provider_enum" AS ENUM('local', 'google', 'apple')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_auth_providers" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "provider" "public"."user_auth_providers_provider_enum" NOT NULL, "provider_id" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_5238694289bea978152906199f6" UNIQUE ("provider", "provider_id"), CONSTRAINT "UQ_d2cd620862a631c16006c9eaac5" UNIQUE ("user_id", "provider"), CONSTRAINT "PK_e3b60f30b8112ac5bb474a2fe4b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1b986eb2b94d3c3beaf580c09" ON "user_auth_providers" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "token_hash" character varying(255) NOT NULL, "device_name" character varying(100), "ip_address" character varying(45), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a3f8ed29c5855aa9d5d9640bfc" ON "refresh_tokens" ("revoked_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_gender_enum" AS ENUM('male', 'female', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_activity_level_enum" AS ENUM('sedentary', 'light', 'moderate', 'active', 'very_active')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_goal_enum" AS ENUM('lose', 'maintain', 'gain')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_profiles" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "gender" "public"."user_profiles_gender_enum", "date_of_birth" date, "height_cm" numeric(5,1), "weight_kg" numeric(5,1), "activity_level" "public"."user_profiles_activity_level_enum", "goal" "public"."user_profiles_goal_enum", "timezone" character varying(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6ca9503d77ae39b4b5a6cc3ba88" UNIQUE ("user_id"), CONSTRAINT "REL_6ca9503d77ae39b4b5a6cc3ba8" UNIQUE ("user_id"), CONSTRAINT "PK_1ec6662219f4605723f1e41b6cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nutrition_goals" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "calories" integer NOT NULL, "protein_g" numeric(5,1), "fat_g" numeric(5,1), "carbs_g" numeric(5,1), "is_custom" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f597d22636d94f843903aeb9aab" UNIQUE ("user_id"), CONSTRAINT "REL_f597d22636d94f843903aeb9aa" UNIQUE ("user_id"), CONSTRAINT "PK_843d6ec58065c4f34aabc9052a3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."food_categories_type_enum" AS ENUM('ingredient', 'dish')`,
    );
    await queryRunner.query(
      `CREATE TABLE "food_categories" ("id" SERIAL NOT NULL, "name_vi" character varying(255) NOT NULL, "name_en" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "type" "public"."food_categories_type_enum" NOT NULL, "source_id" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f3d4b09fc4e57b2183384fdb6b8" UNIQUE ("slug"), CONSTRAINT "PK_b7818b6140a91907d79e0aba514" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nutrients" ("id" SERIAL NOT NULL, "name_vi" character varying(255) NOT NULL, "name_en" character varying(255) NOT NULL, "key" character varying(100) NOT NULL, "unit" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_25ae4445249a5693ebe8caff937" UNIQUE ("key"), CONSTRAINT "PK_05bf070f987b9f67ea7b5896855" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "food_item_nutrients" ("id" SERIAL NOT NULL, "food_item_id" integer NOT NULL, "nutrient_id" integer NOT NULL, "value" numeric(10,4), CONSTRAINT "UQ_af0feff5f54469a65d6f48bfc41" UNIQUE ("food_item_id", "nutrient_id"), CONSTRAINT "PK_640108058f957934148fd5c09c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f6ac130f6eb4973b366ba1999" ON "food_item_nutrients" ("food_item_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "serving_sizes" ("id" SERIAL NOT NULL, "food_item_id" integer NOT NULL, "name_vi" character varying(100) NOT NULL, "name_en" character varying(100) NOT NULL, "grams" numeric(10,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bd1529225383e0689a9e310cd41" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9122e4c3e8f9c6600f939ad1a" ON "serving_sizes" ("food_item_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."food_items_type_enum" AS ENUM('ingredient', 'dish')`,
    );
    await queryRunner.query(
      `CREATE TABLE "food_items" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuidv7(), "type" "public"."food_items_type_enum" NOT NULL, "code" character varying(50) NOT NULL, "name_vi" character varying(255) NOT NULL, "name_en" character varying(255) NOT NULL, "name_ascii" character varying(255), "description" text, "image_url" character varying(500), "energy" numeric(10,2), "category_id" integer NOT NULL, "source_id" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_793d0488bb243f761a557a2c930" UNIQUE ("uuid"), CONSTRAINT "UQ_d7484dd32ed4523629454e23758" UNIQUE ("code"), CONSTRAINT "PK_6b37e62b21c674c714a581c59a6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf31353b77c5507183f82b7a28" ON "food_items" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "custom_meal_entries" ("id" SERIAL NOT NULL, "meal_entry_id" integer NOT NULL, "name" character varying(255) NOT NULL, "calories" numeric(8,2) NOT NULL, "protein_g" numeric(8,2), "fat_g" numeric(8,2), "carbs_g" numeric(8,2), CONSTRAINT "UQ_613c99407f1086c21ef95fb7019" UNIQUE ("meal_entry_id"), CONSTRAINT "REL_613c99407f1086c21ef95fb701" UNIQUE ("meal_entry_id"), CONSTRAINT "PK_403f9b7f0193476ce37aa31692a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "meal_entries" ("id" SERIAL NOT NULL, "meal_id" integer NOT NULL, "food_item_id" integer, "serving_size_id" integer, "quantity" numeric(6,2) NOT NULL, "quantity_grams" numeric(8,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b69a336a32fc8e1a770994db17d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d88ab4545f72b7df902a6dde7" ON "meal_entries" ("meal_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."meals_meal_type_enum" AS ENUM('breakfast', 'lunch', 'dinner', 'snack', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TABLE "meals" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuidv7(), "daily_log_id" integer NOT NULL, "name" character varying(100) NOT NULL, "meal_type" "public"."meals_meal_type_enum" NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ce33ac729b835eacb18cbc07bcc" UNIQUE ("uuid"), CONSTRAINT "PK_e6f830ac9b463433b58ad6f1a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1702a795a6ed8b86e3028ae366" ON "meals" ("daily_log_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_logs" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuidv7(), "user_id" integer NOT NULL, "date" date NOT NULL, "note" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cc0d94408fb93a09ecb23da37bb" UNIQUE ("uuid"), CONSTRAINT "UQ_cd4961aae71dfeaab8130b0b2db" UNIQUE ("user_id", "date"), CONSTRAINT "PK_ea32d6160ba0b85cb14426c50b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28dc684c15a9369be262170f70" ON "daily_logs" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuidv7(), "email" character varying(255) NOT NULL, "password_hash" character varying(255), "name" character varying(100) NOT NULL, "avatar_url" character varying(500), "email_verified" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_951b8f1dfc94ac1d0301a14b7e1" UNIQUE ("uuid"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "weight_logs" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "weight_kg" numeric(5,1) NOT NULL, "logged_at" date NOT NULL, "note" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_51a634dd5cd58a36758b65a13de" UNIQUE ("user_id", "logged_at"), CONSTRAINT "PK_96c8f4d341846b34fef50cf4576" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0341010b3956b50d880f4fe15b" ON "weight_logs" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_auth_providers" ADD CONSTRAINT "FK_f1b986eb2b94d3c3beaf580c092" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nutrition_goals" ADD CONSTRAINT "FK_f597d22636d94f843903aeb9aab" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_item_nutrients" ADD CONSTRAINT "FK_4f6ac130f6eb4973b366ba19994" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_item_nutrients" ADD CONSTRAINT "FK_65c3ad40dedd4ebbeaf7454e878" FOREIGN KEY ("nutrient_id") REFERENCES "nutrients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "serving_sizes" ADD CONSTRAINT "FK_b9122e4c3e8f9c6600f939ad1ad" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_items" ADD CONSTRAINT "FK_bf31353b77c5507183f82b7a28a" FOREIGN KEY ("category_id") REFERENCES "food_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_meal_entries" ADD CONSTRAINT "FK_613c99407f1086c21ef95fb7019" FOREIGN KEY ("meal_entry_id") REFERENCES "meal_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_entries" ADD CONSTRAINT "FK_0d88ab4545f72b7df902a6dde72" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_entries" ADD CONSTRAINT "FK_ddd612243e6c3eb8b2c0241b9af" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_entries" ADD CONSTRAINT "FK_afa575a2065997189b361ef4cab" FOREIGN KEY ("serving_size_id") REFERENCES "serving_sizes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meals" ADD CONSTRAINT "FK_1702a795a6ed8b86e3028ae366a" FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_logs" ADD CONSTRAINT "FK_28dc684c15a9369be262170f705" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weight_logs" ADD CONSTRAINT "FK_0341010b3956b50d880f4fe15bc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_food_items_name_vi_trgm" ON "food_items" USING GIN ("name_vi" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_food_items_name_en_trgm" ON "food_items" USING GIN ("name_en" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weight_logs" DROP CONSTRAINT "FK_0341010b3956b50d880f4fe15bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_logs" DROP CONSTRAINT "FK_28dc684c15a9369be262170f705"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meals" DROP CONSTRAINT "FK_1702a795a6ed8b86e3028ae366a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_entries" DROP CONSTRAINT "FK_afa575a2065997189b361ef4cab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_entries" DROP CONSTRAINT "FK_ddd612243e6c3eb8b2c0241b9af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_entries" DROP CONSTRAINT "FK_0d88ab4545f72b7df902a6dde72"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_meal_entries" DROP CONSTRAINT "FK_613c99407f1086c21ef95fb7019"`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_items" DROP CONSTRAINT "FK_bf31353b77c5507183f82b7a28a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "serving_sizes" DROP CONSTRAINT "FK_b9122e4c3e8f9c6600f939ad1ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_item_nutrients" DROP CONSTRAINT "FK_65c3ad40dedd4ebbeaf7454e878"`,
    );
    await queryRunner.query(
      `ALTER TABLE "food_item_nutrients" DROP CONSTRAINT "FK_4f6ac130f6eb4973b366ba19994"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nutrition_goals" DROP CONSTRAINT "FK_f597d22636d94f843903aeb9aab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_auth_providers" DROP CONSTRAINT "FK_f1b986eb2b94d3c3beaf580c092"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0341010b3956b50d880f4fe15b"`,
    );
    await queryRunner.query(`DROP TABLE "weight_logs"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28dc684c15a9369be262170f70"`,
    );
    await queryRunner.query(`DROP TABLE "daily_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1702a795a6ed8b86e3028ae366"`,
    );
    await queryRunner.query(`DROP TABLE "meals"`);
    await queryRunner.query(`DROP TYPE "public"."meals_meal_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0d88ab4545f72b7df902a6dde7"`,
    );
    await queryRunner.query(`DROP TABLE "meal_entries"`);
    await queryRunner.query(`DROP TABLE "custom_meal_entries"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf31353b77c5507183f82b7a28"`,
    );
    await queryRunner.query(`DROP TABLE "food_items"`);
    await queryRunner.query(`DROP TYPE "public"."food_items_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b9122e4c3e8f9c6600f939ad1a"`,
    );
    await queryRunner.query(`DROP TABLE "serving_sizes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f6ac130f6eb4973b366ba1999"`,
    );
    await queryRunner.query(`DROP TABLE "food_item_nutrients"`);
    await queryRunner.query(`DROP TABLE "nutrients"`);
    await queryRunner.query(`DROP TABLE "food_categories"`);
    await queryRunner.query(`DROP TYPE "public"."food_categories_type_enum"`);
    await queryRunner.query(`DROP TABLE "nutrition_goals"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(`DROP TYPE "public"."user_profiles_goal_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_profiles_activity_level_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_profiles_gender_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a3f8ed29c5855aa9d5d9640bfc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1b986eb2b94d3c3beaf580c09"`,
    );
    await queryRunner.query(`DROP TABLE "user_auth_providers"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_auth_providers_provider_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_food_items_name_en_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_food_items_name_vi_trgm"`,
    );
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`);
  }
}

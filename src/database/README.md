# EatinPal Database Schema

## Group 1: Food Data

### `food_categories`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| name_vi | VARCHAR(255) | NOT NULL | Tên tiếng Việt |
| name_en | VARCHAR(255) | NOT NULL | Tên tiếng Anh |
| slug | VARCHAR(255) | UNIQUE, NOT NULL | URL-friendly identifier |
| type | ENUM('ingredient','dish') | NOT NULL | Loại danh mục |
| source_id | VARCHAR(100) | | ID gốc từ viendinhduong |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `food_items`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| uuid | UUID | UNIQUE, NOT NULL, DEFAULT uuidv7() | Public identifier |
| type | ENUM('ingredient','dish') | NOT NULL | Nguyên liệu hoặc món ăn |
| code | VARCHAR(50) | UNIQUE, NOT NULL | "10001", "HAP-223025" |
| name_vi | VARCHAR(255) | NOT NULL | |
| name_en | VARCHAR(255) | NOT NULL | |
| name_ascii | VARCHAR(255) | | Chỉ dishes có |
| description | TEXT | | Chỉ dishes có |
| image_url | VARCHAR(500) | | Chỉ dishes có |
| energy | DECIMAL(10,2) | | Kcal per 100g |
| category_id | INT | FK → food_categories(id), NOT NULL | |
| source_id | VARCHAR(100) | | ID gốc từ viendinhduong |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `nutrients`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| name_vi | VARCHAR(255) | NOT NULL | |
| name_en | VARCHAR(255) | NOT NULL | |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Slug: "protein", "vitamin-c" |
| unit | VARCHAR(20) | NOT NULL | g, mg, mcg, Kcal |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `food_item_nutrients`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| food_item_id | INT | FK → food_items(id) ON DELETE CASCADE | |
| nutrient_id | INT | FK → nutrients(id) ON DELETE CASCADE | |
| value | DECIMAL(10,4) | | Giá trị per 100g, nullable nếu unknown |
| | | UNIQUE (food_item_id, nutrient_id) | Không trùng nutrient per food |

### `serving_sizes`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| food_item_id | INT | FK → food_items(id) ON DELETE CASCADE | |
| name_vi | VARCHAR(100) | NOT NULL | "1 bát", "1 chén" |
| name_en | VARCHAR(100) | NOT NULL | "1 bowl", "1 cup" |
| grams | DECIMAL(10,2) | NOT NULL | Gram equivalent |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

## Group 2: User & Auth

### `users`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| uuid | UUID | UNIQUE, NOT NULL, DEFAULT uuidv7() | Public identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | |
| password_hash | VARCHAR(255) | | Nullable cho social-only accounts |
| name | VARCHAR(100) | NOT NULL | Display name |
| avatar_url | VARCHAR(500) | | |
| email_verified | BOOLEAN | NOT NULL, DEFAULT false | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `user_auth_providers`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| user_id | INT | FK → users(id) ON DELETE CASCADE | |
| provider | ENUM('local','google','apple') | NOT NULL | |
| provider_id | VARCHAR(255) | | Null nếu local |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| | | UNIQUE (user_id, provider) | Mỗi provider 1 entry per user |
| | | UNIQUE (provider, provider_id) | Không link cùng social account cho nhiều users |

### `refresh_tokens`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| user_id | INT | FK → users(id) ON DELETE CASCADE | |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | SHA-256 hash |
| device_name | VARCHAR(100) | | "iPhone 15", "Samsung Galaxy S24" |
| ip_address | VARCHAR(45) | | IPv4/IPv6 |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| revoked_at | TIMESTAMPTZ | | Null = active, set khi revoke |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `user_profiles`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| user_id | INT | FK → users(id) ON DELETE CASCADE, UNIQUE | 1-1 với users |
| gender | ENUM('male','female','other') | | |
| date_of_birth | DATE | | |
| height_cm | DECIMAL(5,1) | | |
| weight_kg | DECIMAL(5,1) | | Cân nặng hiện tại |
| activity_level | ENUM('sedentary','light','moderate','active','very_active') | | |
| goal | ENUM('lose','maintain','gain') | | |
| timezone | VARCHAR(50) | NOT NULL, DEFAULT 'Asia/Ho_Chi_Minh' | IANA timezone |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `nutrition_goals`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| user_id | INT | FK → users(id) ON DELETE CASCADE, UNIQUE | 1-1 với users |
| calories | INT | NOT NULL | Kcal/day |
| protein | DECIMAL(5,1) | | |
| fat | DECIMAL(5,1) | | |
| carbs | DECIMAL(5,1) | | |
| is_custom | BOOLEAN | NOT NULL, DEFAULT false | True nếu user override TDEE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `weight_logs`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| user_id | INT | FK → users(id) ON DELETE CASCADE | |
| weight_kg | DECIMAL(5,1) | NOT NULL | |
| logged_at | DATE | NOT NULL | Ngày cân |
| note | VARCHAR(255) | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| | | UNIQUE (user_id, logged_at) | Mỗi user 1 record per ngày |

## Group 3: Meal Tracking

### `daily_logs`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| uuid | UUID | UNIQUE, NOT NULL, DEFAULT uuidv7() | Public identifier |
| user_id | INT | FK → users(id) ON DELETE CASCADE | |
| date | DATE | NOT NULL | Ngày tracking |
| note | VARCHAR(500) | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| | | UNIQUE (user_id, date) | Mỗi user 1 log per ngày |

### `meals`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| uuid | UUID | UNIQUE, NOT NULL, DEFAULT uuidv7() | Public identifier |
| daily_log_id | INT | FK → daily_logs(id) ON DELETE CASCADE | |
| name | VARCHAR(100) | NOT NULL | "Bữa sáng", "Snack" |
| meal_type | ENUM('breakfast','lunch','dinner','snack','custom') | NOT NULL | |
| sort_order | INT | NOT NULL, DEFAULT 0 | Thứ tự hiển thị trong ngày |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `meal_entries`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| meal_id | INT | FK → meals(id) ON DELETE CASCADE | |
| food_item_id | INT | FK → food_items(id) | Null nếu custom entry |
| serving_size_id | INT | FK → serving_sizes(id) | Null nếu dùng gram trực tiếp |
| quantity | DECIMAL(6,2) | NOT NULL | Số serving hoặc gram |
| quantity_grams | DECIMAL(8,2) | NOT NULL | Luôn quy đổi ra gram |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `custom_meal_entries`

| Column | Type | Constraints | Note |
|--------|------|-------------|------|
| id | SERIAL | PK | |
| meal_entry_id | INT | FK → meal_entries(id) ON DELETE CASCADE, UNIQUE | 1-1 với meal_entries |
| name | VARCHAR(255) | NOT NULL | Tên user tự đặt |
| calories | DECIMAL(8,2) | NOT NULL | |
| protein | DECIMAL(8,2) | | |
| fat | DECIMAL(8,2) | | |
| carbs | DECIMAL(8,2) | | |

## Entity Relationships

```
food_categories 1──N food_items
food_items      1──N food_item_nutrients N──1 nutrients
food_items      1──N serving_sizes
food_items      1──N meal_entries

users           1──1 user_profiles
users           1──1 nutrition_goals
users           1──N user_auth_providers
users           1──N refresh_tokens
users           1──N weight_logs
users           1──N daily_logs

daily_logs      1──N meals
meals           1──N meal_entries
meal_entries    1──1 custom_meal_entries (optional)
meal_entries    N──1 serving_sizes (optional)
```

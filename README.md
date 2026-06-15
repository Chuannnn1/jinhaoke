# 金濠客食堂 POS 系統

前台點餐 + 後台管理，Next.js 14 (App Router) + SQLite (better-sqlite3)。

## 啟動

```bash
npm install
npm run dev
# http://localhost:3000        ← 前台點餐
# http://localhost:3000/admin  ← 後台
```

第一次啟動 `lib/db.ts` 會自動跑 `lib/schema.sql` + `scripts/seed-data.js`，不需手動 init。

## 目錄結構

```
app/
  page.jsx                  前台點餐
  admin/                    後台
    page.tsx                訂單看板（五狀態色帶）
    menu/                   菜單管理
    inventory/              庫存（含低庫存彈窗 + 補貨）
    purchase/               採購管理（驗貨 / 退貨 / 列印）
    suppliers/, ingredients/, reports/
  api/                      Route Handlers
lib/
  db.ts                     SQLite singleton
  schema.sql                Schema (含 ingredient_supplier 多廠商表)
scripts/
  init-db.js                建表 + seed
  seed-data.js              預設菜單 / 食材 / 供應商 / image_url
  seed-multi-supplier.js    Mock 多廠商關係
  migrate-*.js              欄位 / 資料修補（idempotent）
public/uploads/menu/        菜單 webp 圖（seed-data.js 預設指向這裡）
data/jinhaoke.db            SQLite 檔（gitignored）
deploy/                     Ubuntu 部署腳本
```

## 資料庫操作

```bash
# 全新環境 — 建表 + 跑所有 seed
node scripts/init-db.js

# 只跑 seed（DB 已存在）
node scripts/seed-only.js

# 多廠商假資料（含廠商改名為 X 老闆）
node scripts/seed-multi-supplier.js

# 修補既有 DB 的 menu image_url
node scripts/migrate-fix-menu-images.js
```

## Schema 重點

| 表 | 主鍵 | 備註 |
|---|---|---|
| supplier | name | 改用 X 老闆命名（王 / 陳 / 周 / 黃 / 蘇 / 林 / 謝） |
| ingredient | name | `supplier_name` 是 primary 廠商鏡像 |
| ingredient_supplier | (ingredient_name, supplier_name) | 一食材多廠商，`is_primary` + `price_per_order_unit` |
| menu_item | item_id | `image_url` 指 `/uploads/menu/*.webp` |
| recipe | (item_id, ingredient_name) | 配方 |
| `"order"` | order_id | 五狀態：待製作 → 製作中 → 待付款 → 已完成 / 已取消 |
| order_item | (order_id, item_id) | `unit_price` 存快照 |
| purchase_order / purchase_order_item / return_order | | 採購 + 退貨 |

PK rename 用 `ON UPDATE CASCADE` 自動傳遞到外鍵。

## 庫存異動時機

| 動作 | 觸發 | 影響 |
|---|---|---|
| 下單 | POST `/api/orders` | 寫 order + order_item，**不扣庫存** |
| 出餐完成 | PATCH `/api/orders/status` → 已完成 | 依 recipe 扣食材 |
| 驗貨入庫 | PATCH `/api/purchase/:po_id` → 已驗貨 | 加食材庫存 |
| 退貨 | POST `/api/purchase-orders/:id/return` | 減食材庫存 |

## API 回傳格式

```ts
{ success: true, data: ... }
{ success: false, error: '...' }
```

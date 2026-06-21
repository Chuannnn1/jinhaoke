# Schema v4 API Agent Spec

> 給其他 agent 的改檔指引。拿到就能直接開工。
> 主 agent 已完成 Task 0 (schema.sql + lib 層)，以下 Task 可並行。

---

## 核心規則

1. **所有 SQL 的表名和欄位名改中文**，必須用反引號包裹（如 `` `訂單` ``, `` `訂單編號` ``）
2. **TypeScript interface 的 property name 也改中文**，因為 mysql2 回傳的 key 就是中文欄位名
3. API 外層 wrapper（`success`, `error`, `data`）保持英文不動
4. `getPool()` 從 `@/lib/db` import，不動
5. `RowDataPacket`, `ResultSetHeader` 從 `mysql2/promise` import，不動

---

## 完整表名對照

| 舊表名 | 新表名 |
|---|---|
| supplier | 供應商 |
| ingredient | 食材 |
| menu_item | 餐點 |
| recipe | 食譜 |
| delivery_customer | **已刪除** |
| order | 訂單 |
| order_item | 訂單明細 |
| purchase_order | 採購單 |
| purchase_order_item | 採購單明細 |
| return_order | 退貨單 |
| ingredient_supplier | **已刪除** |
| admin_session | 管理員登入 |
| admin_setting | 管理員設定 |

---

## 完整欄位對照

### 供應商

| 舊 | 新 | 備註 |
|---|---|---|
| name | 供應商名稱 | PK |
| phone | 供應商電話 | |
| owner_name | — | 已刪 |
| category | — | 已刪 |

### 食材

| 舊 | 新 | 備註 |
|---|---|---|
| name | 食材名稱 | PK |
| stock_qty | 庫存數量 | |
| safety_stock | 安全存量 | |
| stock_unit | 庫存單位 | |
| supplier_name | 供應商名稱 | FK → 供應商 |
| order_unit | — | 已刪 |
| qty_per_order_unit | — | 已刪 |
| category | — | 已刪 |
| order_block_threshold | — | 已刪 |

### 餐點

| 舊 | 新 | 備註 |
|---|---|---|
| item_id | 餐點編號 | PK AUTO_INCREMENT |
| name | 餐點名稱 | UNIQUE |
| category | 餐點分類 | |
| price | 餐點價格 | |
| tag | 分類標籤 | |
| sub | — | 已刪（併入餐點描述） |
| option | — | 已刪（併入餐點描述） |
| description | 餐點描述 | 合併 sub+option+description |
| is_active | 上下架狀態 | |
| addons | 客製化屬性 | JSON |
| emoji | 圖示 | |
| image_url | 圖片網址 | |

### 食譜

| 舊 | 新 |
|---|---|
| item_id | 餐點編號 |
| ingredient_name | 食材名稱 |
| consume_qty | 食材數量 |

### 訂單

| 舊 | 新 | 備註 |
|---|---|---|
| order_id | 訂單編號 | PK |
| order_date | 訂單日期 | DATETIME（合併了 created_at + updated_at） |
| created_at | — | 已刪（併入訂單日期） |
| updated_at | — | 已刪（併入訂單日期） |
| status | 訂單狀態 | 值: 待製作/製作中/待付款/已完成/已取消 |
| customer_phone | 顧客電話 | 無 FK |
| note | 備註 | |

### 訂單明細

| 舊 | 新 | 備註 |
|---|---|---|
| order_id | 訂單編號 | PK part |
| item_id | 餐點編號 | PK part |
| quantity | 數量 | |
| customizations | 客製化 | JSON |
| unit_price | — | 已刪 |
| customizations_amount | — | 已刪 |

### 採購單

| 舊 | 新 | 備註 |
|---|---|---|
| po_id | 採購單編號 | PK AUTO_INCREMENT |
| po_date | 採購單日期 | DATE |
| supplier_name | 供應商名稱 | FK |
| total_amount | 進貨食材總成本 | |
| status | 採購單狀態 | **值改**: 已下單/已到貨/已取消 |

### 採購單明細

| 舊 | 新 | 備註 |
|---|---|---|
| po_id | 採購單編號 | PK part |
| ingredient_name | 食材名稱 | PK part |
| order_qty | 數量 | |
| total_cost | — | 已刪 |

### 退貨單

| 舊 | 新 |
|---|---|
| return_id | 退貨單編號 |
| po_id | 採購單編號 |
| ingredient_name | 食材名稱 |
| return_date | 退貨單日期 |
| return_reason | 退貨原因 |
| return_qty | 退貨數量 |

### 管理員登入

| 舊 | 新 |
|---|---|
| token | 登入令牌 |
| created_at | 建立時間 |
| expires_at | 過期時間 |
| last_seen | 最後活動 |
| user_agent | 裝置資訊 |

### 管理員設定

| 舊 | 新 |
|---|---|
| key | 設定鍵 |
| value | 設定值 |
| updated_at | 更新時間 |

---

## 採購單狀態值對照

| 舊值 | 新值 |
|---|---|
| 已訂購 | 已下單 |
| 已驗貨 | 已到貨 |
| 已退貨 | 已取消 |

---

## 邏輯變更摘要

### 營收計算

```
舊: SUM(oi.unit_price * oi.quantity) + customizations_amount
新: SUM(m.`餐點價格` * od.`數量`)   -- JOIN 訂單明細 od + 餐點 m
```

addon 費用暫不計入。

### delivery_customer 已刪

- 不再 INSERT/upsert delivery_customer
- 不再 LEFT JOIN delivery_customer
- `顧客電話` 是 `訂單` 表的普通欄位，無 FK
- `customer_name` 不存了。GET 訂單時不回傳 customer_name，或固定給空字串

### ingredient_supplier 已刪

- 不再查 ingredient_supplier 表
- 食材的供應商只看 `食材.供應商名稱` (1:1)
- `app/api/ingredients/[name]/suppliers/route.ts` 整個刪除

### 新增採購單

- POST 只允許 `採購單狀態` = `'已下單'`

---

## Task 1 — Auth API (6 檔)

### 檔案清單

| 檔案 | 動作 |
|---|---|
| `app/api/auth/me/route.ts` | 改名 |
| `app/api/auth/login/route.ts` | 改名 |
| `app/api/auth/logout/route.ts` | 改名 |
| `app/api/auth/setup/route.ts` | 改名 |
| `app/api/auth/setup-status/route.ts` | 改名 |
| `app/api/auth/change-password/route.ts` | 改名 |

### 改什麼

SQL 中的表名/欄位名全部換中文：

```
admin_session → `管理員登入`
admin_setting → `管理員設定`
token → `登入令牌`
created_at → `建立時間`
expires_at → `過期時間`
last_seen → `最後活動`
user_agent → `裝置資訊`
`key` → `設定鍵`
`value` → `設定值`
updated_at → `更新時間`
```

TypeScript interface 的 property name 同步改中文。

---

## Task 2 — Orders API (5 檔)

### 檔案清單

| 檔案 | 動作 |
|---|---|
| `app/api/orders/route.ts` | 大改 |
| `app/api/orders/[id]/route.ts` | 改名 |
| `app/api/orders/status/route.ts` | 改名 |
| `app/api/orders/import/route.ts` | 大改 |
| `app/api/orders/auto-restock/route.ts` | 改名 + 刪欄 |

### orders/route.ts GET

- `order` → `` `訂單` ``、`order_item` → `` `訂單明細` ``、`menu_item` → `` `餐點` ``
- **移除** `LEFT JOIN delivery_customer dc ON o.customer_phone = dc.phone`
- **移除** `dc.name AS customer_name`
- **移除** `oi.unit_price AS price` → 改用 `mi.price AS ...` 但注意欄位已改名為 `m.餐點價格`
- **移除** `oi.customizations_amount`
- `o.created_at` → `o.訂單日期`
- `o.customer_phone` → `o.顧客電話`
- `o.note` → `o.備註`
- `o.status` → `o.訂單狀態`
- `oi.quantity` → `od.數量`
- `oi.customizations` → `od.客製化`
- `mi.name` → `m.餐點名稱`
- `mi.addons` → `m.客製化屬性`
- GroupedOrder interface: property name 全改中文
- subtotal 計算改用 `餐點價格 * 數量`（不加 customizations_amount）

### orders/route.ts POST

- **移除** delivery_customer upsert（那段 INSERT INTO delivery_customer ... ON DUPLICATE KEY）
- `顧客電話` 直接存到 `訂單` 表，不需先建 delivery_customer
- INSERT `訂單`: 只寫 `訂單編號`, `訂單日期`(DATETIME), `訂單狀態`, `顧客電話`, `備註`
- INSERT `訂單明細`: 只寫 `訂單編號`, `餐點編號`, `數量`, `客製化`（不寫 unit_price, customizations_amount）
- `訂單日期` 用 `new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')` 產生 DATETIME 格式字串

### orders/[id]/route.ts

- SQL 改中文表名/欄位名
- `created_at` → `訂單日期`
- **移除** unit_price 從 order_item 讀的邏輯
- subtotal 改用 JOIN `餐點` 拿 `餐點價格`

### orders/status/route.ts

- `order` → `` `訂單` ``、`order_item` → `` `訂單明細` ``、`menu_item` → `` `餐點` ``、`ingredient` → `` `食材` ``
- 欄位名全換
- `oi.customizations` → `od.客製化`
- `mi.name` → `m.餐點名稱`
- `ingredient SET stock_qty = stock_qty - ?` → `` `食材` SET `庫存數量` = `庫存數量` - ? ``

### orders/import/route.ts

- SQL 改中文表名/欄位名
- **移除** `INSERT IGNORE INTO delivery_customer`
- INSERT `訂單`: 不寫 `created_at`, `updated_at`，只寫 `訂單日期` (DATETIME)
- INSERT `訂單明細`: 不寫 `unit_price`
- `menu_item` → `` `餐點` ``，`item_id` → `餐點編號`，`name` → `餐點名稱` 等

### orders/auto-restock/route.ts

- SQL 改中文表名/欄位名
- 移除 `order_unit`, `qty_per_order_unit` 引用
- `ingredient` → `` `食材` ``，`supplier` → `` `供應商` `` 等

---

## Task 3 — Menu + Ingredients + Inventory + Suppliers API (12 檔)

### 檔案清單

| 檔案 | 動作 |
|---|---|
| `app/api/menu/route.ts` | 改名 + 合併欄 |
| `app/api/menu/[id]/route.ts` | 改名 + 合併欄 |
| `app/api/menu/upload/route.ts` | 改名 |
| `app/api/menu/availability/route.ts` | 改名（主要靠 lib） |
| `app/api/ingredients/route.ts` | 改名 + 刪欄 |
| `app/api/ingredients/[name]/route.ts` | 改名 + 刪欄 |
| `app/api/ingredients/[name]/suppliers/route.ts` | **整個刪除** |
| `app/api/inventory/route.ts` | 改名 + 刪欄 |
| `app/api/inventory/[name]/route.ts` | 改名 + 刪欄 |
| `app/api/inventory/low-stock/route.ts` | 改名 |
| `app/api/suppliers/route.ts` | 改名 + 刪欄 |
| `app/api/suppliers/[name]/route.ts` | 改名 + 刪欄 |

### menu/route.ts

- `menu_item` → `` `餐點` ``
- SELECT: `item_id` → `餐點編號`, `name` → `餐點名稱`, `category` → `餐點分類`, `price` → `餐點價格`, `emoji` → `圖示`, `tag` → `分類標籤`, `sub` → 刪, `option` → 刪, `description` → `餐點描述`, `is_active` → `上下架狀態`, `image_url` → `圖片網址`, `addons` → `客製化屬性`
- INSERT: 不再寫 sub, option，只寫 `餐點描述`
- interface property name 全改中文

### menu/[id]/route.ts

- 同上規則
- PATCH: 移除 `sub` 和 `option` 的更新邏輯，只保留 `餐點描述`

### menu/upload/route.ts

- `menu_item` → `` `餐點` ``
- `item_id` → `餐點編號`
- `image_url` → `圖片網址`

### menu/availability/route.ts

- 主要邏輯在 `lib/availability.ts`（已由 Task 0 處理）
- 回傳的 property name 看 availability 回的結構，property name 需對應

### ingredients/route.ts, ingredients/[name]/route.ts

- `ingredient` → `` `食材` ``
- 移除 SELECT/UPDATE 中的 `order_unit`, `qty_per_order_unit`, `category`, `order_block_threshold`
- 欄位名全換

### ingredients/[name]/suppliers/route.ts

- **整個檔案刪除**（含目錄 `app/api/ingredients/[name]/suppliers/`）

### inventory/route.ts, inventory/[name]/route.ts, inventory/low-stock/route.ts

- `ingredient` → `` `食材` ``、`supplier` → `` `供應商` ``
- 移除 `order_unit`, `qty_per_order_unit`, `order_block_threshold` 的 SELECT/UPDATE
- 移除 `category` 的 SELECT/UPDATE
- 欄位名全換

### suppliers/route.ts, suppliers/[name]/route.ts

- `supplier` → `` `供應商` ``
- 移除 `owner_name`, `category` 的 SELECT/INSERT/UPDATE
- 欄位名全換

---

## Task 4 — Purchase + Reports API (10 檔)

### 檔案清單

| 檔案 | 動作 |
|---|---|
| `app/api/purchase/route.ts` | 改名 + 改狀態 + 刪欄 |
| `app/api/purchase/[po_id]/route.ts` | 改名 + 改狀態 + 刪欄 |
| `app/api/purchase/auto-generate/route.ts` | 大改 |
| `app/api/purchase-orders/route.ts` | 改名 + 改狀態 |
| `app/api/purchase-orders/[id]/route.ts` | 改名 + 改狀態 |
| `app/api/purchase-orders/[id]/receive/route.ts` | 改名 + 改狀態 |
| `app/api/purchase-orders/[id]/return/route.ts` | 改名 |
| `app/api/reports/overview/route.ts` | 改名 + 營收算法改 |
| `app/api/reports/daily/route.ts` | 改名 + 營收算法改 |
| `app/api/reports/monthly/route.ts` | 改名 + 營收算法改 |

### 採購單共通改動

所有 purchase 相關檔案：
- `purchase_order` → `` `採購單` ``、`purchase_order_item` → `` `採購單明細` ``、`return_order` → `` `退貨單` ``
- `po_id` → `採購單編號`、`po_date` → `採購單日期`、`supplier_name` → `供應商名稱`、`total_amount` → `進貨食材總成本`、`status` → `採購單狀態`
- `ingredient_name` → `食材名稱`、`order_qty` → `數量`
- `return_id` → `退貨單編號`、`return_date` → `退貨單日期`、`return_reason` → `退貨原因`、`return_qty` → `退貨數量`
- **狀態值**: `'已訂購'` → `'已下單'`、`'已驗貨'` → `'已到貨'`、`'已退貨'` → `'已取消'`
- **total_cost 欄位已刪**: 移除所有 INSERT/SELECT/SUM(total_cost) 邏輯

### purchase/route.ts

- GET: 移除 `total_cost` 的 SELECT 和 returned_qty 的計算中 total_cost 引用
- POST: 移除 `total_cost` 的 INSERT；`totalAmount` 計算不再用 item.total_cost（設 0 或移除）
- POST: 狀態只允許 `'已下單'`（不允許建立時就設 '已到貨' 或 '已取消'）
- 邊界：若建單時 status='已到貨' → 拒絕（改成只能是 '已下單'）

### purchase/[po_id]/route.ts

- loadOrder: 移除 total_cost 的 SELECT
- PATCH: 移除 total_cost 的 upsert 和 SUM 計算
- ALLOWED_STATUS 改為 `['已下單', '已到貨', '已取消']`
- `enteringReceived` 判斷: `body.採購單狀態 === '已到貨' && prevStatus !== '已到貨'`

### purchase/auto-generate/route.ts

- `ingredient` → `` `食材` ``、`supplier` → `` `供應商` ``
- **移除** ingredient_supplier 的查詢（那段 `SELECT s.price_per_order_unit ... FROM ingredient_supplier s`）
- 進貨食材總成本 設 0
- 採購單明細 INSERT 不寫 total_cost

### purchase-orders/[id]/receive/route.ts

- `'已驗貨'` → `'已到貨'`
- 欄位名全換

### purchase-orders/[id]/return/route.ts

- 欄位名全換

### reports/overview/route.ts

- 營收計算:
  ```sql
  -- 舊: SUM(oi.unit_price * oi.quantity) AS revenue
  -- 新: SUM(m.`餐點價格` * od.`數量`) AS revenue
  ```
- 需要額外 JOIN `餐點` 表（如果原本只 JOIN 了 order_item）
- `order` → `` `訂單` ``、`order_item` → `` `訂單明細` ``
- 所有欄位名改中文

### reports/daily/route.ts, reports/monthly/route.ts

- 同 overview 的營收計算改法
- 欄位名全換

---

## SQL 書寫範例

改前：
```sql
SELECT o.order_id, o.status, o.created_at, oi.item_id, oi.quantity, oi.unit_price, mi.name
FROM `order` o
LEFT JOIN order_item oi ON o.order_id = oi.order_id
LEFT JOIN menu_item mi ON oi.item_id = mi.item_id
LEFT JOIN delivery_customer dc ON o.customer_phone = dc.phone
```

改後：
```sql
SELECT o.`訂單編號`, o.`訂單狀態`, o.`訂單日期`, od.`餐點編號`, od.`數量`, m.`餐點價格`, m.`餐點名稱`
FROM `訂單` o
LEFT JOIN `訂單明細` od ON o.`訂單編號` = od.`訂單編號`
LEFT JOIN `餐點` m ON od.`餐點編號` = m.`餐點編號`
```

TypeScript interface 改前：
```typescript
interface OrderRow extends RowDataPacket {
  order_id: string
  status: string
  created_at: string
}
```

改後：
```typescript
interface OrderRow extends RowDataPacket {
  訂單編號: string
  訂單狀態: string
  訂單日期: string
}
```

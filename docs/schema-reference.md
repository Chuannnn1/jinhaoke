# 資料庫 Schema 說明文件

> 對應：`lib/schema.sql`（v3，2026-05-22）
> 用途：了解每張表的欄位意義，實作 API / 前端 時查閱

---

## 命名規則

| 類型 | 規則 | 範例 |
|------|------|------|
| Table 名 | 全小寫、底線分隔 | `menu_item` |
| 保留字 table 名 | 雙引號包住 | `"order"` |
| Column 名 | 全小寫、底線分隔 | `item_id` |
| JavaScript / TypeScript | 駝峰式 | `itemId`、`customerName` |

---

## 10張表詳細說明

### 1. `supplier`（供應商）

```sql
CREATE TABLE supplier (
    name  TEXT PRIMARY KEY,   -- 供應商名稱（PK，直接用名稱不另外用 ID）
    phone TEXT
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `name` | TEXT PK | 供應商名稱（不另外用數字 ID）|
| `phone` | TEXT | 聯絡電話 |

**設計決策**：直接用 name 作為 PK，減少 JOIN 複雜度。

---

### 2. `ingredient`（食材）

```sql
CREATE TABLE ingredient (
    name               TEXT    PRIMARY KEY,
    stock_qty          REAL    NOT NULL DEFAULT 0,
    safety_stock       REAL    NOT NULL DEFAULT 0,
    stock_unit         TEXT    NOT NULL,            -- 庫存單位（斤 / 片 / 隻）
    order_unit         TEXT    NOT NULL,            -- 叫貨單位（箱 / 包 / 盒）
    qty_per_order_unit REAL    NOT NULL,            -- 每個叫貨單位 = 多少 stock_unit
    supplier_name      TEXT,
    FOREIGN KEY (supplier_name) REFERENCES supplier(name)
        ON UPDATE CASCADE ON DELETE SET NULL
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `name` | TEXT PK | 食材名稱 |
| `stock_qty` | REAL | **目前庫存**（stock_unit 下的量）|
| `safety_stock` | REAL | **安全存量**，低於此值要補貨 |
| `stock_unit` | TEXT | 庫存計量和位（如：斤、片、隻、kg）|
| `order_unit` | TEXT | 叫貨單位（如：箱、包、盒）|
| `qty_per_order_unit` | REAL | **每個叫貨單位等於多少 stock_unit** |
| `supplier_name` | TEXT FK | 供應商名稱 |

**叫貨單位設計意義：**

```
範例：胛心肉
  stock_unit = "斤"         ← 庫存系統追蹤的單位
  order_unit = "箱"         ← 跟肉商叫貨時說的單位
  qty_per_order_unit = 10   ← 1箱 = 10斤

老闆說：「叫2箱」
→ 實際入庫：2 × 10 = 20 斤
→ 系統執行：UPDATE ingredient SET stock_qty = stock_qty + 20 WHERE name = '胛心肉'
```

---

### 3. `menu_item`（菜單）

```sql
CREATE TABLE menu_item (
    item_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    category    TEXT,
    price       INTEGER NOT NULL,
    emoji       TEXT    NOT NULL DEFAULT '',
    tag         TEXT    NOT NULL DEFAULT '其他',   -- 蛋白質分類（魚/豬/雞/牛/其他）
    sub         TEXT    NOT NULL DEFAULT '',       -- 副標說明（扁鱈/無骨/二片）
    option      TEXT    NOT NULL DEFAULT '',       -- 加購說明（加肉60/加菜10）
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1         -- 軟刪除旗標
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `item_id` | INTEGER PK | 餐點 ID（AUTOINCREMENT）|
| `name` | TEXT UNIQUE | 餐點名稱 |
| `category` | TEXT | 分類：手作便當 / 燴飯 / 單點 |
| `price` | INTEGER | 價格（整數，預設台幣元）|
| `emoji` | TEXT | 顯示用表情符號（未來替換成上傳照片）|
| `tag` | TEXT | 蛋白質分類（魚/豬/雞/牛/其他），前台篩選用 |
| `sub` | TEXT | 副標說明（扁鱈/無骨/二片）|
| `option` | TEXT | 加購說明（加肉60/加菜10）|
| `description` | TEXT | 品項描述 |
| `is_active` | INTEGER | 軟刪除：1=上架中，0=已下架 |

**軟刪除意義**：下架一道菜時 `UPDATE menu_item SET is_active = 0`，歷史訂單不受影響。

---

### 4. `recipe`（食譜/配方）

```sql
CREATE TABLE recipe (
    item_id          INTEGER NOT NULL,
    ingredient_name  TEXT    NOT NULL,
    consume_qty      REAL    NOT NULL,  -- 每份餐點消耗多少（stock_unit）
    PRIMARY KEY (item_id, ingredient_name),
    FOREIGN KEY (item_id) REFERENCES menu_item(item_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (ingredient_name) REFERENCES ingredient(name)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `item_id` | INTEGER PK/FK | 餐點 ID |
| `ingredient_name` | TEXT PK/FK | 食材名稱 |
| `consume_qty` | REAL | **每份餐點消耗多少該食材**（stock_unit）|

**為什麼需要這張表？**

```
顧客點「蒜泥白肉」→ 系統查詢 recipe
→ 知道要扣「胛心肉 0.3 斤」
→ 執行：UPDATE ingredient SET stock_qty = stock_qty - 0.3 WHERE name = '胛心肉'
```

這是「出餐時自動扣庫存」的依據。

---

### 5. `delivery_customer`（外送顧客）

```sql
CREATE TABLE delivery_customer (
    phone        TEXT PRIMARY KEY,
    house_number TEXT,
    address      TEXT,
    name         TEXT
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `phone` | TEXT PK | 顧客電話 |
| `house_number` | TEXT | 門牌號碼 |
| `address` | TEXT | 地址 |
| `name` | TEXT | 顧客姓名 |

**設計原因**：3NF（第三正規化）。
如果地址存在 `order` 表，修改同一顧客的地址會需要更新多筆訂單。
獨立成表後，`order` 只存 `customer_phone`，地址更新一次即可。

---

### 6. `"order"`（顧客訂單）

```sql
CREATE TABLE "order" (
    order_id       TEXT    PRIMARY KEY,
    order_date     TEXT    NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', '+8 hours')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now', '+8 hours')),
    status         TEXT    NOT NULL DEFAULT '待製作'
                   CHECK (status IN ('待製作','製作中','待付款','已完成','已取消')),
    customer_phone TEXT,
    FOREIGN KEY (customer_phone) REFERENCES delivery_customer(phone)
        ON UPDATE CASCADE ON DELETE SET NULL
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `order_id` | TEXT PK | 訂單編號（格式：`A202605260001`）|
| `order_date` | TEXT | 訂單日期（YYYY-MM-DD）|
| `created_at` | TEXT | 建立時間（含時區 +8 小時）|
| `updated_at` | TEXT | 最後更新時間 |
| `status` | TEXT | 狀態：待製作 / 製作中 / 待付款 / 已完成 / 已取消 |
| `customer_phone` | TEXT FK | 外送顧客電話（內用可 NULL）|

**訂單編號產生方式**：
```javascript
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')  // "20260526"
const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0')  // "0001"
const orderId = `A${today}${random}`  // "A202605260001"
```

---

### 7. `order_item`（訂單明細）

```sql
CREATE TABLE order_item (
    order_id   TEXT    NOT NULL,
    item_id    INTEGER NOT NULL,
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL,               -- ★ 下單時的單價快照
    PRIMARY KEY (order_id, item_id),
    FOREIGN KEY (order_id) REFERENCES "order"(order_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES menu_item(item_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `order_id` | TEXT PK/FK | 訂單編號 |
| `item_id` | INTEGER PK/FK | 餐點 ID |
| `quantity` | INTEGER | 數量（需 > 0）|
| `unit_price` | INTEGER | **下單時的單價快照** |

**為什麼要存快照？**

```
今天：蒜泥白肉 160 元，顧客下單
     → order_item.unit_price = 160

明天：老闆調漲為 180 元
     → 歷史訂單不變，仍然是 160 元
     → 如果存的是 menu_item.price，明天就變成 180 元了
```

---

### 8. `purchase_order`（進貨單主表）

```sql
CREATE TABLE purchase_order (
    po_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    po_date       TEXT    NOT NULL,
    supplier_name TEXT    NOT NULL,
    total_amount  REAL    NOT NULL DEFAULT 0,  -- 驗貨後彙總
    status        TEXT    NOT NULL DEFAULT '已訂購'
                   CHECK (status IN ('已訂購','已驗貨','部分退貨')),
    FOREIGN KEY (supplier_name) REFERENCES supplier(name)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `po_id` | INTEGER PK | 進貨單 ID（自增）|
| `po_date` | TEXT | 進貨日期 |
| `supplier_name` | TEXT FK | 供應商名稱 |
| `total_amount` | REAL | 總金額（驗貨後彙總）|
| `status` | TEXT | 狀態：已訂購 / 已驗貨 / 部分退貨 |

---

### 9. `purchase_order_item`（進貨明細）

```sql
CREATE TABLE purchase_order_item (
    po_id           INTEGER NOT NULL,
    ingredient_name TEXT    NOT NULL,
    order_qty       REAL    NOT NULL,           -- 進貨數量（stock_unit）
    total_cost      REAL    NOT NULL DEFAULT 0, -- 總成本（驗貨後填入）
    PRIMARY KEY (po_id, ingredient_name),
    FOREIGN KEY (po_id) REFERENCES purchase_order(po_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (ingredient_name) REFERENCES ingredient(name)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `po_id` | INTEGER PK/FK | 進貨單 ID |
| `ingredient_name` | TEXT PK/FK | 食材名稱 |
| `order_qty` | REAL | 叫貨數量（stock_unit）|
| `total_cost` | REAL | 總成本（驗貨後才填入）|

---

### 10. `return_order`（退貨單）

```sql
CREATE TABLE return_order (
    po_id           INTEGER NOT NULL,
    ingredient_name TEXT    NOT NULL,
    return_date     TEXT    NOT NULL,
    return_reason   TEXT,
    return_qty      REAL    NOT NULL,
    PRIMARY KEY (po_id, ingredient_name),
    FOREIGN KEY (po_id, ingredient_name)
        REFERENCES purchase_order_item(po_id, ingredient_name)
        ON UPDATE CASCADE ON DELETE CASCADE
);
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `po_id` | INTEGER PK/FK | 進貨單 ID |
| `ingredient_name` | TEXT PK/FK | 食材名稱 |
| `return_date` | TEXT | 退貨日期 |
| `return_reason` | TEXT | 退貨原因 |
| `return_qty` | REAL | 退貨數量 |

**複合 FK**：退貨單的 `(po_id, ingredient_name)` 直接參考 `purchase_order_item` 的複合主鍵。

---

## 庫存異動時機

| 動作 | 觸發時機 | 影響 |
|------|---------|------|
| **下單** | POST `/api/orders` | 只寫入 order + order_item，**不扣庫存** |
| **出餐** | PATCH `/api/orders/status` → `done` | 查 `recipe`，扣各項食材庫存 |
| **進貨入庫** | POST `/api/purchase-orders/:id/receive` | 增加 `ingredient.stock_qty` |
| **退貨** | POST `/api/purchase-orders/:id/return` | 減少 `ingredient.stock_qty` |

---

## 索引（加速查詢）

```sql
CREATE INDEX idx_menu_category   ON menu_item(category);
CREATE INDEX idx_menu_active     ON menu_item(is_active);
CREATE INDEX idx_menu_tag        ON menu_item(tag);
CREATE INDEX idx_order_date      ON "order"(order_date);
CREATE INDEX idx_order_status    ON "order"(status);
CREATE INDEX idx_recipe_item     ON recipe(item_id);
CREATE INDEX idx_recipe_ingredient ON recipe(ingredient_name);
CREATE INDEX idx_po_date         ON purchase_order(po_date);
CREATE INDEX idx_po_status       ON purchase_order(status);
```

---

## SQL 語法要點

### 時間一律 +8 小時（SQLite 沒有時區）

```sql
-- 寫入現在時間（自動執行）
created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))

-- 手動查詢今天訂單
SELECT * FROM "order" WHERE order_date = date('now', '+8 hours', 'localtime')
```

### 保留字 table 名要加雙引號

```sql
-- "order" 是 SQL 保留字
SELECT * FROM "order" WHERE order_id = 'A202605260001'
```

### Transaction 範例

```sql
-- 寫入訂單（包在 API 的 db.transaction() 裡執行）
BEGIN;
  INSERT INTO delivery_customer (phone, name, address) VALUES ('0912-345-678', '王小明', '台北市...');
  INSERT INTO "order" (order_id, order_date, status, customer_phone, note)
    VALUES ('A202605260001', '2026-05-26', '待製作', '0912-345-678', '不要蔥');
  INSERT INTO order_item (order_id, item_id, quantity, unit_price)
    VALUES ('A202605260001', 1, 2, 130);
COMMIT;
-- 如果中途失敗，全部 rollback，不留不完整的資料
```
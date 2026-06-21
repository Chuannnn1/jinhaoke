# Schema v4 重構 Spec — 中文欄位命名 + 文件對齊

> 日期：2026-06-20
> 目標：將 jinhaoke POS 系統 DB schema 對齊 ER 文件，全部改用中文表名/欄位名

---

## 一、變更總覽

| 動作 | 項目 |
|---|---|
| **刪表** | `delivery_customer`, `ingredient_supplier` |
| **刪欄** | ingredient: order_unit, qty_per_order_unit, category, order_block_threshold |
| **刪欄** | supplier: owner_name, category |
| **刪欄** | order_item: unit_price, customizations_amount |
| **刪欄** | purchase_order_item: total_cost |
| **合併** | order: order_date+created_at+updated_at → 訂單日期 (DATETIME) |
| **合併** | menu_item: sub+option+description → 餐點描述 |
| **刪 FK** | order.customer_phone 不再 FK 到 delivery_customer |
| **改狀態值** | 採購單: 已訂購→已下單, 已驗貨→已到貨, 已退貨→已取消 |
| **刪頁面** | `app/admin/purchase/[po_id]/print/page.tsx` |
| **刪 API** | `app/api/ingredients/[name]/suppliers/route.ts` |
| **全改名** | 全部 11 張表 + 所有欄位改中文 |

---

## 二、完整表名對照

| 舊表名 | 新表名 | 動作 |
|---|---|---|
| supplier | 供應商 | 改名 |
| ingredient | 食材 | 改名 + 刪欄 |
| menu_item | 餐點 | 改名 + 合併欄 |
| recipe | 食譜 | 改名 |
| delivery_customer | — | 刪除 |
| order | 訂單 | 改名 + 合併欄 |
| order_item | 訂單明細 | 改名 + 刪欄 |
| purchase_order | 採購單 | 改名 + 改狀態值 |
| purchase_order_item | 採購單明細 | 改名 + 刪欄 |
| return_order | 退貨單 | 改名 |
| ingredient_supplier | — | 刪除 |
| admin_session | 管理員登入 | 改名 |
| admin_setting | 管理員設定 | 改名 |

---

## 三、完整欄位對照（按表）

### 供應商 (原 supplier)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| name | 供應商名稱 | 改名, PK |
| phone | 供應商電話 | 改名 |
| owner_name | — | 刪除 |
| category | — | 刪除 |

### 食材 (原 ingredient)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| name | 食材名稱 | 改名, PK |
| stock_qty | 庫存數量 | 改名 |
| safety_stock | 安全存量 | 改名 |
| stock_unit | 庫存單位 | 改名 |
| supplier_name | 供應商名稱 | 改名, FK |
| order_unit | — | 刪除 |
| qty_per_order_unit | — | 刪除 |
| category | — | 刪除 |
| order_block_threshold | — | 刪除 |

### 餐點 (原 menu_item)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| item_id | 餐點編號 | 改名, PK AUTO_INCREMENT |
| name | 餐點名稱 | 改名, UNIQUE |
| category | 餐點分類 | 改名 |
| price | 餐點價格 | 改名 |
| tag | 分類標籤 | 改名 |
| sub | — | 刪除（併入餐點描述） |
| option | — | 刪除（併入餐點描述） |
| description | 餐點描述 | 改名（合併 sub+option） |
| is_active | 上下架狀態 | 改名 |
| addons | 客製化屬性 | 改名, JSON |
| emoji | 圖示 | 改名（系統欄位） |
| image_url | 圖片網址 | 改名（系統欄位） |

### 食譜 (原 recipe)

| 舊欄位 | 新欄位 |
|---|---|
| item_id | 餐點編號 |
| ingredient_name | 食材名稱 |
| consume_qty | 食材數量 |

### 訂單 (原 order)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| order_id | 訂單編號 | 改名, PK |
| order_date | 訂單日期 | 改名, 型別改 DATETIME（合併 created_at+updated_at） |
| created_at | — | 刪除（併入訂單日期） |
| updated_at | — | 刪除（併入訂單日期） |
| status | 訂單狀態 | 改名, CHECK: 待製作/製作中/待付款/已完成/已取消 |
| customer_phone | 顧客電話 | 改名, 刪除 FK |
| note | 備註 | 改名 |

### 訂單明細 (原 order_item)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| order_id | 訂單編號 | 改名, PK part |
| item_id | 餐點編號 | 改名, PK part |
| quantity | 數量 | 改名 |
| customizations | 客製化 | 改名, JSON |
| unit_price | — | 刪除 |
| customizations_amount | — | 刪除 |

### 採購單 (原 purchase_order)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| po_id | 採購單編號 | 改名, PK AUTO_INCREMENT |
| po_date | 採購單日期 | 改名, DATE |
| supplier_name | 供應商名稱 | 改名, FK |
| total_amount | 進貨食材總成本 | 改名 |
| status | 採購單狀態 | 改名, 值改: 已下單/已到貨/已取消 |

### 採購單明細 (原 purchase_order_item)

| 舊欄位 | 新欄位 | 動作 |
|---|---|---|
| po_id | 採購單編號 | 改名, PK part |
| ingredient_name | 食材名稱 | 改名, PK part |
| order_qty | 數量 | 改名 |
| total_cost | — | 刪除 |

### 退貨單 (原 return_order)

| 舊欄位 | 新欄位 |
|---|---|
| return_id | 退貨單編號 |
| po_id | 採購單編號 |
| ingredient_name | 食材名稱 |
| return_date | 退貨單日期 |
| return_reason | 退貨原因 |
| return_qty | 退貨數量 |

### 管理員登入 (原 admin_session)

| 舊欄位 | 新欄位 |
|---|---|
| token | 登入令牌 |
| created_at | 建立時間 |
| expires_at | 過期時間 |
| last_seen | 最後活動 |
| user_agent | 裝置資訊 |

### 管理員設定 (原 admin_setting)

| 舊欄位 | 新欄位 |
|---|---|
| key | 設定鍵 |
| value | 設定值 |
| updated_at | 更新時間 |

---

## 四、狀態值對照

### 採購單狀態（改值）

| 舊值 | 新值 |
|---|---|
| 已訂購 | 已下單 |
| 已驗貨 | 已到貨 |
| 已退貨 | 已取消 |

### 訂單狀態（不改，保留現行）

待製作 / 製作中 / 待付款 / 已完成 / 已取消

---

## 五、邏輯變更

### 營收計算

- 舊: `SUM(oi.unit_price * oi.quantity) + customizations_amount`
- 新: `SUM(m.餐點價格 * od.數量)` (JOIN 訂單明細 + 餐點)
- addon 費用暫不計入，列為後續維護項目

### 接單暫停

- 舊: stock_qty <= order_block_threshold (或 safety_stock * 0.2)
- 新: 暫時不擋，availability 的 blocked 改為 stock_qty <= 0

### 下單流程

- 舊: 先 upsert delivery_customer → 再 INSERT order → INSERT order_item (含 unit_price, customizations_amount)
- 新: 直接 INSERT 訂單 → INSERT 訂單明細 (不寫 unit_price, 不寫 customizations_amount, 不操作 delivery_customer)

### 新增採購單

- POST 只允許狀態 '已下單'（不允許建立時就設 '已到貨' 或 '已取消'）

---

## 六、Task 分配

### Task 0 — Schema DDL + lib 層

由主 agent 執行。

**檔案：**
- `lib/schema.sql` — 全部重寫
- `lib/auth.ts` — 表名/欄位名改中文
- `lib/availability.ts` — 改中文 + 刪除 order_block_threshold
- `lib/order-consumption.ts` — 改中文

### Task 1 — API: Auth (6 檔)

- `app/api/auth/me/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/setup/route.ts`
- `app/api/auth/setup-status/route.ts`
- `app/api/auth/change-password/route.ts`

### Task 2 — API: Orders (5 檔)

- `app/api/orders/route.ts`
- `app/api/orders/[id]/route.ts`
- `app/api/orders/status/route.ts`
- `app/api/orders/import/route.ts`
- `app/api/orders/auto-restock/route.ts`

### Task 3 — API: Menu + Ingredients + Inventory + Suppliers (12 檔)

- `app/api/menu/route.ts`
- `app/api/menu/[id]/route.ts`
- `app/api/menu/upload/route.ts`
- `app/api/menu/availability/route.ts`
- `app/api/ingredients/route.ts`
- `app/api/ingredients/[name]/route.ts`
- `app/api/ingredients/[name]/suppliers/route.ts` — **刪除**
- `app/api/inventory/route.ts`
- `app/api/inventory/[name]/route.ts`
- `app/api/inventory/low-stock/route.ts`
- `app/api/suppliers/route.ts`
- `app/api/suppliers/[name]/route.ts`

### Task 4 — API: Purchase + Reports (10 檔)

- `app/api/purchase/route.ts`
- `app/api/purchase/[po_id]/route.ts`
- `app/api/purchase/auto-generate/route.ts`
- `app/api/purchase-orders/route.ts`
- `app/api/purchase-orders/[id]/route.ts`
- `app/api/purchase-orders/[id]/receive/route.ts`
- `app/api/purchase-orders/[id]/return/route.ts`
- `app/api/reports/overview/route.ts`
- `app/api/reports/daily/route.ts`
- `app/api/reports/monthly/route.ts`

### Task 5 — Frontend Pages (7 檔)

- `app/admin/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/menu/page.tsx`
- `app/admin/inventory/page.tsx`
- `app/admin/purchase/page.tsx`
- `app/admin/login/page.tsx`
- `app/admin/purchase/[po_id]/print/page.tsx` — **刪除**

### Task 6 — Scripts (3 檔)

- `scripts/init-db.js`
- `scripts/seed-data.js`
- `scripts/seed-only.js`

### Task 7 — Build + 資料遷移 + VM 部署

由主 agent 執行。

---

## 七、執行順序

```
Task 0 (主 agent)  ──→  Task 1~6 (並行)  ──→  Task 7 (主 agent)
```

## 八、新 DDL

```sql
CREATE TABLE IF NOT EXISTS `供應商` (
    `供應商名稱`   VARCHAR(100) PRIMARY KEY,
    `供應商電話`   TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `食材` (
    `食材名稱`     VARCHAR(100) PRIMARY KEY,
    `庫存數量`     DOUBLE  NOT NULL DEFAULT 0,
    `安全存量`     DOUBLE  NOT NULL DEFAULT 0,
    `庫存單位`     VARCHAR(20) NOT NULL,
    `供應商名稱`   VARCHAR(100),
    FOREIGN KEY (`供應商名稱`) REFERENCES `供應商`(`供應商名稱`)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `餐點` (
    `餐點編號`     INT PRIMARY KEY AUTO_INCREMENT,
    `餐點名稱`     VARCHAR(100) NOT NULL UNIQUE,
    `餐點分類`     VARCHAR(50),
    `餐點價格`     INT NOT NULL,
    `分類標籤`     VARCHAR(50) NOT NULL DEFAULT '其他',
    `餐點描述`     TEXT,
    `上下架狀態`   TINYINT NOT NULL DEFAULT 1,
    `客製化屬性`   TEXT NOT NULL DEFAULT '[]',
    `圖示`         VARCHAR(10) NOT NULL DEFAULT '',
    `圖片網址`     TEXT NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `食譜` (
    `餐點編號`     INT NOT NULL,
    `食材名稱`     VARCHAR(100) NOT NULL,
    `食材數量`     DOUBLE NOT NULL,
    PRIMARY KEY (`餐點編號`, `食材名稱`),
    FOREIGN KEY (`餐點編號`) REFERENCES `餐點`(`餐點編號`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (`食材名稱`) REFERENCES `食材`(`食材名稱`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `訂單` (
    `訂單編號`     VARCHAR(20) PRIMARY KEY,
    `訂單日期`     DATETIME NOT NULL,
    `訂單狀態`     VARCHAR(20) NOT NULL DEFAULT '待製作',
    `顧客電話`     VARCHAR(50),
    `備註`         TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `訂單明細` (
    `訂單編號`     VARCHAR(20) NOT NULL,
    `餐點編號`     INT NOT NULL,
    `數量`         INT NOT NULL CHECK (`數量` > 0),
    `客製化`       TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (`訂單編號`, `餐點編號`),
    FOREIGN KEY (`訂單編號`) REFERENCES `訂單`(`訂單編號`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (`餐點編號`) REFERENCES `餐點`(`餐點編號`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `採購單` (
    `採購單編號`   INT PRIMARY KEY AUTO_INCREMENT,
    `採購單日期`   DATE NOT NULL,
    `供應商名稱`   VARCHAR(100) NOT NULL,
    `進貨食材總成本` DOUBLE NOT NULL DEFAULT 0,
    `採購單狀態`   VARCHAR(20) NOT NULL DEFAULT '已下單',
    FOREIGN KEY (`供應商名稱`) REFERENCES `供應商`(`供應商名稱`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `採購單明細` (
    `採購單編號`   INT NOT NULL,
    `食材名稱`     VARCHAR(100) NOT NULL,
    `數量`         DOUBLE NOT NULL,
    PRIMARY KEY (`採購單編號`, `食材名稱`),
    FOREIGN KEY (`採購單編號`) REFERENCES `採購單`(`採購單編號`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (`食材名稱`) REFERENCES `食材`(`食材名稱`)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `退貨單` (
    `退貨單編號`   INT PRIMARY KEY AUTO_INCREMENT,
    `採購單編號`   INT NOT NULL,
    `食材名稱`     VARCHAR(100) NOT NULL,
    `退貨單日期`   DATE NOT NULL,
    `退貨原因`     TEXT,
    `退貨數量`     DOUBLE NOT NULL,
    FOREIGN KEY (`採購單編號`, `食材名稱`)
        REFERENCES `採購單明細`(`採購單編號`, `食材名稱`)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `管理員登入` (
    `登入令牌`     VARCHAR(64) PRIMARY KEY,
    `建立時間`     DATETIME NOT NULL,
    `過期時間`     DATETIME NOT NULL,
    `最後活動`     DATETIME,
    `裝置資訊`     TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `管理員設定` (
    `設定鍵`       VARCHAR(100) PRIMARY KEY,
    `設定值`       TEXT NOT NULL,
    `更新時間`     DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

# 金濠客 POS — Session Notes

> 給後續 session / branch agent 接手的進度記錄。本檔在 repo root，每次有重大進度就追加區段。

---

## 當前狀態（2026-06-08）

- **Branch**：`main`
- **HEAD commit**：`072b623` — feat: 菜單圖片上傳、庫存接單限制、訂單 CSV 匯入
- **Dev server**：port 3100（`npm run dev`）
- **DB 路徑**：`data/jinhaoke.db`（schema v3 + 三個 migration 已套用）

### 已完成模組

| 模組 | 範圍 | 狀態 |
|---|---|---|
| **狀態對齊修復** | order CHECK constraint 三值→五值；status route `stock`→`stock_qty` | ✅ smoke tested |
| **菜單管理** | sharp 圖片上傳、下架管理、UI 重排、前台 `<img>` 渲染 | ✅ API smoke tested，UI 未在瀏覽器肉眼驗證 |
| **庫存管理** | 吃掉供應商 panel、`order_block_threshold` 接單限制、availability API | ✅ API smoke tested，UI 未肉眼驗證 |
| **訂單匯入** | CSV 模板 + preview/confirm 兩段式 | ✅ API smoke tested，UI 未肉眼驗證 |

---

## DB Schema 變更（本次 session）

### `"order".status` CHECK constraint
舊：`('待製作','製作中','已完成')` → 新：`('待製作','製作中','待付款','已完成','已取消')`

Migration：`scripts/migrate-order-status-constraint.js`（table recreation pattern）

### `menu_item` 加欄位
```sql
image_url TEXT NOT NULL DEFAULT ''
```
- 路徑格式：`/uploads/menu/{item_id}_{ts}.webp`
- 對應 thumb：同檔名加 `_thumb`
- Migration：`scripts/migrate-add-menu-image.js`（idempotent，`PRAGMA table_info` 檢查）

### `ingredient` 加欄位
```sql
order_block_threshold REAL DEFAULT NULL
```
- NULL = fallback 用 `safety_stock × 0.2`（用戶要求 1/5）
- Migration：`scripts/migrate-add-block-threshold.js`

---

## 重要 API 對照

| Endpoint | 用途 | 備註 |
|---|---|---|
| `GET /api/menu` | 前台菜單 | 預設只回 `is_active=1`；後台帶 `?include_inactive=1` |
| `POST /api/menu/upload` | 圖片上傳 | multipart，`file` + `item_id`；sharp resize 800×600 + 200×200 thumb |
| `PATCH /api/menu/[id]` | 重新上架 | body `{ is_active: 0|1 }` |
| `GET /api/menu/availability` | 每品項可做幾份 | 回 `{ item_id, max_servings, blocked, blocking_ingredients }` |
| `GET /api/inventory` | 庫存清單 | 包含 `order_block_threshold` |
| `PATCH /api/inventory/[name]` | 局部更新 | `supplier_name` / `safety_stock` / `order_block_threshold` / `stock_qty` |
| `POST /api/orders` | 建立訂單 | **server-side 二次驗證 availability**，blocked 回 400「品項已售完：X, Y」 |
| `POST /api/orders/import` | CSV 匯入 | preview only（無 `confirm`）/ 寫入（`confirm=1`） |
| `PATCH /api/orders/status` | 改狀態 | English key → 中文 statusMap；已完成時 transaction 扣庫存 |

共用 helper：`lib/availability.ts` 的 `computeAvailability()` —— API 和 POST orders 都呼叫這支，避免邏輯雙寫。

---

## 前後台 UX 約定

### 菜單顯示
- **前台 `app/page.jsx` 卡片**：`image_url` 存在 → `<img class="h-24 w-full object-cover">`，否則顯示 fallback「老闆還未上傳圖片~」
- **前台購物車 row**：保留 emoji 當小 icon（沒改）
- **後台菜單表格**：emoji 欄改成圖片縮圖（56×56），下架列灰底 opacity-50

### 接單限制
- 任一食材 `stock_qty <= effective_threshold` → menu_item.`blocked = true`
- **前台應該卡片灰掉 + 顯示「售完」+ 禁止加購物車**（用戶已決定，但**前台 UI 還沒實際接 availability API**，目前只有 server-side 驗證會擋下）

### 庫存頁
- Sub-tab：`?tab=inventory` / `?tab=suppliers`
- 舊 `/admin/suppliers` 路徑會 redirect 過去
- 供應商欄改 inline `<select>` 直接 PATCH

---

## 未完成 / 後續 Follow-up

1. **前台 availability 整合** ⚠️：`app/page.jsx` 目前還沒呼叫 `/api/menu/availability`。應該在 fetchMenu 同時抓 availability，blocked 的卡片灰掉、不能加購物車（目前只靠 POST 失敗來擋）
2. **UI 肉眼驗證**：API 都通了，但 UI（圖片上傳 modal、庫存 sub-tab、CSV preview modal）還沒在瀏覽器跑過 golden path
3. **TS errors 已清**：`app/admin/page.tsx` 補了 `useState<any[]>([])` / drag handler 類型
4. **gitignore 更新**：加了 `tsconfig.tsbuildinfo` 和 `public/uploads/`
5. **同步到 WSL**：之前的 workflow 是 Windows 改完 → 同步到 WSL 測 → 由 WSL push。這次直接從 Windows push（用戶要求其他 agent 開 branch），WSL 那邊要先 `git pull`

---

## 啟動 / 常用指令

```powershell
# 啟動 dev server
cd C:\Users\Chuannnn\Documents\GitHub\jinhaoke
npm run dev   # port 3100

# 跑 migration（如果換環境或 DB 重建）
node scripts/migrate-order-status-constraint.js
node scripts/migrate-add-menu-image.js
node scripts/migrate-add-block-threshold.js

# Type check
npx tsc --noEmit
```

### 驗證 DB schema
```bash
node -e "const Database = require('better-sqlite3'); const db = new Database('./data/jinhaoke.db', { readonly: true }); console.log('menu_item:', db.pragma('table_info(menu_item)').map(c=>c.name).join(',')); console.log('ingredient:', db.pragma('table_info(ingredient)').map(c=>c.name).join(',')); console.log('order CHECK:', db.prepare(\"SELECT sql FROM sqlite_master WHERE type='table' AND name='order'\").get().sql.match(/CHECK[^,]+/)?.[0]);"
```

---

## 已知 Bug / Gotchas

- **Windows ↔ WSL line ending**：git 會自動 LF↔CRLF，commit warning 可忽略
- **dev server hot reload**：批次改檔時建議先停 server，動完再啟（避免 partial reload）
- **better-sqlite3 file lock**：跑 migration 前要確認 dev server 已停
- **schema.sql `IF NOT EXISTS`**：對既有 table 不會套用變更 — 改 schema 後必須寫 migration script

---

## Module ABC 詳細任務 prompt

如果要 branch agent 接續或回滾，可從 commit `072b623` 看 diff。三個模組的詳細實作 prompt（檔案範圍、ALLOWED/FORBIDDEN）保留在 Claude session 紀錄裡，需要時可回查。

# scripts/ — 資料庫工具

金濠客 POS 系統的 DB 初始化、migration、seed 工具。

## 一鍵指令（package.json）

```bash
npm run db:init      # 建表 + 跑 migration + seed（新環境就跑這個）
npm run db:migrate   # 只跑 migration（補欄位 / 改 CHECK）
npm run db:seed      # 只跑 seed（補預設品項）
```

> 跑任何 DB 指令前，先停 `npm run dev`，否則 better-sqlite3 會撞 file lock。

## 新環境 setup

```bash
git clone <repo>
cd jinhaoke
npm install
npm run db:init      # ← 建表 + 跑全部 migration + seed
npm run dev
```

`data/jinhaoke.db` 不會被 commit（在 `.gitignore`），每位開發者各自 init。

## 流程說明（init-db.js）

| Step | 動作                                     | 行為                                |
| ---- | ---------------------------------------- | ----------------------------------- |
| 1    | 跑 `lib/schema.sql`                      | `CREATE TABLE IF NOT EXISTS` — 安全 |
| 2    | 依序跑所有 `scripts/migrate-*.js`        | 每個 migration 自己檢查，已新版會 skip |
| 3    | 跑 `scripts/seed-data.js` 的 `seedAll()` | per-table 檢查 COUNT，空表才插入    |

整個流程 **完全 idempotent**，重複跑不會炸。

## 為什麼新環境會跳 CHECK constraint / FK 錯誤？

過去的問題：
- `lib/schema.sql` 已升 v3（5 值 CHECK、`image_url`、`order_block_threshold`）
- 但 migration 檔（`migrate-*.js`）依賴 DB 已存在
- 開發者新環境 clone 後沒先建 DB 就跑 migration → 報「找不到 DB」
- 或者跑了舊 `lib/db.ts` 的 seed.sql，`order` 那邊的舊 CHECK 值跟新 status 衝突

修正：
- `init-db.js` 統一處理建表 → migration → seed 的順序
- seed 邏輯改用 JS（`seed-data.js`），per-table COUNT 檢查，重跑安全
- `lib/db.ts` 也改呼叫 `seed-data.js`，跟 init-db 共用同一份資料

## 各檔案職責

| 檔案                                    | 用途                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `init-db.js`                            | 一鍵：schema + migration + seed                              |
| `seed-data.js`                          | 預設品項 / 食材 / 供應商 / 食譜（JS 模組，可被多人 require）  |
| `seed-only.js`                          | 只跑 seed（DB 已存在）                                        |
| `migrate-order-status-constraint.js`    | 把 `"order".status` CHECK 從 3 值改 5 值                      |
| `migrate-add-menu-image.js`             | 給 `menu_item` 加 `image_url`                                 |
| `migrate-add-block-threshold.js`        | 給 `ingredient` 加 `order_block_threshold`                    |

## seed 內容

- **5 家供應商**：海鮮批發工、肉品大王、大成肉品、糧油行、蔬果行
- **12 種食材**：魚排、豬排、帶骨排骨、紅麴豬、炸排骨、鱸雞腿、蘇嫩雞腿、牛肉、豬肉、沙茶雞、白米、高麗菜
- **25 個品項**：8 個手作便當、3 個燴飯、14 個單點（含加購）
- **22 條食譜**：8 個便當 + 3 個燴飯的食材消耗對應
- **3 位外送顧客**：示範資料

訂單 / 進貨單 **不 seed**（避免污染真實資料）。

## 加新品項 / 食材

直接改 `seed-data.js` 裡的 `MENU_ITEMS` / `INGREDIENTS` / `RECIPES`，然後：

1. 砍掉 `data/jinhaoke.db`（會丟失現有資料！）
2. 跑 `npm run db:init`

或者只想加品項到現有 DB → 用 POS 介面的「商品管理」加。

# API 開發指南

> 給組員閱讀：了解 HTTP 方法語意 + 統一規範
> 基於金濠客食堂真實菜單為範例

---

## 1. HTTP 方法語意

餐廳對照：

| 方法 | 在餐廳等同於 | 做的事 |
|------|------------|--------|
| **GET** | 拿菜單來看 | 只讀取，不改任何東西 |
| **POST** | 客人**點菜** | 新增一筆資料 |
| **PUT** | 廚房**改單**（整筆換掉） | 完整替換一筆資料 |
| **PATCH** | 服務生**調整**某項（如加辣） | 只改部分欄位 |
| **DELETE** | 撕掉這張訂單 | 刪除（軟刪或真刪）|

---

## 2. 以金濠客菜單為例

### 以「沙茶牛肉燴飯」（item_id=9）為例

**GET /api/menu/9** — 看這道菜長什麼樣
```
→ 只讀取，不改任何東西
→ 結果：{ "item_id": 9, "name": "沙茶牛肉燴飯", "price": 110, "option": "加肉60 / 加菜10" }
```

**PUT /api/menu/9** — 這道菜整筆資料換掉
```json
// body（全部欄位都要帶）：
{
  "name": "沙茶牛肉燴飯（加強版）",
  "category": "燴飯",
  "price": 130,
  "emoji": "🥩",
  "tag": "牛",
  "sub": "",
  "option": "加肉+80 / 加菜15",
  "description": "加量版沙茶牛肉"
}
// → 你送什麼，就完整存成什麼，其他沒帶的欄位會變成 NULL 或 default
// → 幾乎很少用這個，通常用 PATCH
```

**PATCH /api/menu/9** — 只改一個欄位
```json
// body（只帶要改的）：
{ "price": 120 }
// → 只有 price 變，其他欄位不動
// → 這是日常最常用的修改方式
```

**DELETE /api/menu/9** — 這道菜從菜單上移除
```json
// 軟刪除（軟 Soft Delete）：
→ UPDATE menu_item SET is_active = 0 WHERE item_id = 9
// → 資料庫裡還在，只是前端看不到了，歷史訂單不受影響

// 硬刪除（很少用）：
→ DELETE FROM menu_item WHERE item_id = 9
// → 資料庫裡真的消失，NOT RECOMMENDED
```

### 以新增一道菜為例

**POST /api/menu** — 新增一道菜到菜單
```json
// 請求：
{
  "name": "蒜泥魚柳便當",
  "category": "手作便當",
  "price": 140,
  "emoji": "🐟",
  "tag": "魚",
  "sub": "無刺",
  "option": "",
  "description": "新推出的魚肉便當"
}

// 成功回應（201）：
{ "success": true, "data": { "item_id": 26 } }
```

---

## 3. 統一回應格式

```typescript
// ✅ 成功
{ "success": true, "data": { ... } }

// ❌ 失敗（參數錯誤）
{ "success": false, "error": "錯誤原因" }
```

| HTTP Status | 意義 |
|-------------|------|
| 200 | 查詢/修改成功 |
| 201 | 新增成功 |
| 400 | 參數錯誤（缺少必填欄位） |
| 404 | 找不到資源 |
| 500 | 伺服器錯誤 |

---

## 4. 每個 Route Handler 必備區塊

```typescript
export async function GET(req, { params }) {
  try {
    // 1. 取得參數（query string 或 params）
    // 2. 驗證參數（id 是否為數字、必填欄位是否存在）
    // 3. 操作資料庫
    // 4. 回傳結果
    return NextResponse.json({ success: true, data: ... })
  } catch (err) {
    console.error('[GET /api/...]', err)
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
```

> `console.error` 要寫，這樣 server log 才有記錄，Production Debug 全靠這個。

---

## 5. 參數取得方式

### Query String（GET 參數）
```typescript
// GET /api/menu?category=手作便當
const { searchParams } = new URL(req.url)
const category = searchParams.get('category')
```

### Path Parameters（動態路由）
```typescript
// [id]/route.ts — GET /api/menu/9
export async function GET(_req, { params }) {
  const id = parseInt(params.id, 10)  // "9" → 9
  // params.id 是 string，要轉數字
}
```

### Request Body（POST / PUT / PATCH）
```typescript
const body = await req.json()
// body 就是前端送的 JSON 物件
```

---

## 6. 驗證必填欄位

```typescript
// POST /api/menu — 至少要傳 name、category、price
if (!body.name || !body.category || body.price === undefined) {
  return NextResponse.json(
    { success: false, error: 'name、category、price 為必填欄位' },
    { status: 400 }
  )
}
```

---

## 7. Transaction 要一起成功或一起失敗

下訂單時同時寫入 `order` + `order_item` + `delivery_customer`，必須包在同一筆 transaction：

```typescript
const insertOrder = db.prepare('INSERT INTO "order" ...')
const insertOrderItem = db.prepare('INSERT INTO order_item ...')
const upsertCustomer = db.prepare('INSERT INTO delivery_customer ...')

db.transaction(() => {
  upsertCustomer.run(customer_phone, customer_name)
  insertOrder.run(order_id, ...)
  for (const item of items) {
    insertOrderItem.run(order_id, item.item_id, item.quantity)
  }
})()
// 如果中途失敗，全部 rollback，不會留下不完整的訂單
```

---

## 8. PUT vs PATCH 什麼時候用？

| 情況 | 用什麼 |
|------|--------|
| 只改 price | PATCH |
| 只改庫存數量 | PATCH |
| 只改訂單狀態 | PATCH |
| 表單編輯，把所有欄位全部重填一次送出 | PUT（全換掉） |

**簡單記法：PATCH = 改一點，PUT = 全換掉**
> 大部分情況用 PATCH 就對了

---

## 9. 軟刪除 vs 硬刪除

### 軟刪除（Soft Delete）✅
```typescript
// DELETE /api/menu/9
UPDATE menu_item SET is_active = 0 WHERE item_id = 9
// 資料還在，歷史訂單不影響
```

### 硬刪除（Hard Delete）❌ 不建議
```typescript
DELETE FROM menu_item WHERE item_id = 9
// 真的從資料庫消失，可能破壞外鍵約束或歷史訂單
```

> menu_item、ingredient、supplier 等**主要資料表**一律用軟刪除

---

## 10. 實作檢查清單（寫完一支 API 後自我檢查）

- [ ] try-catch 包住了嗎？
- [ ] `console.error` 有寫嗎？
- [ ] 參數有驗證嗎？（缺少必填欄位要 return 400）
- [ ] 找不到資源要 return 404
- [ ] 新增成功要 return 201，不是 200
- [ ] Transaction 操作有包 `db.transaction()` 嗎？
- [ ] 軟刪除用 `UPDATE is_active = 0`，不是 `DELETE`
- [ ] 回應格式是 `{ success, data }` 或 `{ success, error }` 嗎？
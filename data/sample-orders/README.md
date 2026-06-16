# sample-orders/

店家匯出的真實 CSV 訂單，2026-05-19 → 2026-06-05 共 15 天。

## 用途

- **import 測試資料**：跑 `匯入訂單` → 選任一張 CSV 上傳預覽 / 確認，驗證
  pipeline 對齊 menu code 26-31（加菜 / 加肉 / 加飯 / 沙茶燴雞肉）等項目。
- **mock data 種子**：之後寫一支 `npm run db:seed-orders` 一次把這 15 個檔
  灌進去，產生 dashboard 折線 / top items 可看到的數據。
- **regression baseline**：CSV 解析 / 拆 code / 拆 *N qty / 拆辣度 等規則改動時
  拿來跑一輪確認沒退化。

## 格式

UTF-8 + BOM，header 固定：

```
編號,金額,電話,付款狀態,品項,辣度
```

- `品項`：分號分隔 code，可選 `*N`（例 `5;21`、`5*14;7*12`）
- `辣度`：分號分隔（無/小/微/大/null），對齊 `品項` 順序
- `付款狀態`：0=未付、1=已付

詳細 import 判斷規則寫在 `app/api/orders/import/route.ts` 檔頭 comment。

## 為什麼放 repo 裡

訂單內容沒有 PII（電話多為 null 或 3 碼桌號），是店家 POS 的彙整匯出。放 repo
方便 clone 下來立刻有東西可以測，不用每次重新跟店家拿。

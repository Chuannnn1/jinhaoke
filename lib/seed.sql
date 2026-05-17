-- ============================================================
-- 金濠客食堂 POS 系統 — 測試資料 Seed
-- ============================================================

-- ============================================================
-- 供應商（supplier）
-- ============================================================
INSERT INTO supplier (name, contact_name, phone, address) VALUES
  ('大成肉品', '王大強', '0921-111-222', '台北市肉品批發市場'),
  ('全聯實業', '林小文', '0932-333-444', '全聯總倉'),
  ('三商家購', '陳美華', '0943-444-555', '三商家購總部');

-- ============================================================
-- 食材（ingredient）
-- ============================================================
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('排骨', '斤', 30, 10, 150, 1);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('白米', '公斤', 100, 30, 40, 2);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('麵條', '公斤', 20, 8, 35, 2);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('雞腿', '斤', 15, 5, 120, 1);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('高麗菜', '公斤', 25, 10, 30, 3);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('蔥', '把', 40, 15, 20, 3);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('豆皮', '片', 60, 20, 5, 2);
INSERT INTO ingredient (name, unit, stock_qty, safety_stock, cost_per_unit, supplier_id) VALUES
  ('貢丸', '斤', 20, 8, 80, 1);

-- ============================================================
-- 餐點（menu_item）
-- ============================================================
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('牛肉麵', '主食', 120, '紅燒湯頭', 50, 1);
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('水餃', '主食', 80, '現包水餃', 80, 2);
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('酸辣湯', '湯品', 50, '微辣', 60, 3);
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('豆漿', '飲料', 25, '現磨', 100, 4);
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('小菜一號', '小菜', 30, '豆干花生', 40, 5);
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('雞腿飯', '主食', 100, '滷雞腿', 40, 6);
INSERT INTO menu_item (name, category, price, description, stock_qty, sort_order) VALUES
  ('陽春麵', '主食', 60, '清湯', 50, 7);

-- ============================================================
-- 食譜（recipe）— 餐點組成（消耗哪些食材）
-- ============================================================
-- 牛肉麵：排骨(0.5斤) + 麵條(0.3公斤)
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (1, 1, 0.5);
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (1, 3, 0.3);
-- 水餃：麵條(0.2公斤) + 高麗菜(0.1公斤)
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (2, 3, 0.2);
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (2, 5, 0.1);
-- 酸辣湯：蔥(0.1把)
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (3, 6, 0.1);
-- 小菜一號：豆皮(3片) + 花生
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (5, 7, 3);
-- 雞腿飯：雞腿(0.8斤) + 白米(0.4公斤)
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (6, 4, 0.8);
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (6, 2, 0.4);
-- 陽春麵：麵條(0.3公斤) + 蔥(0.05把)
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (7, 3, 0.3);
INSERT INTO recipe (item_id, ingredient_id, consume_qty) VALUES (7, 6, 0.05);

-- ============================================================
-- 外送顧客（delivery_customer）
-- ============================================================
INSERT INTO delivery_customer (phone, name, address) VALUES
  ('0912-345-678', '王小明', '台北市大安區新生南路一段'),
  ('0933-456-789', '陳小美', '新北市板橋區中山路'),
  ('0944-567-890', '張小華', '台北市信義區基隆路');

-- ============================================================
-- 顧客訂單（"order"）
-- ============================================================
INSERT INTO "order" (order_id, customer_name, customer_phone, status, note) VALUES
  ('20260517001', '王小明', '0912-345-678', 'completed', '不要辣'),
  ('20260517002', '陳小美', '0933-456-789', 'pending', ''),
  ('20260517003', '張小華', '0944-567-890', 'cooking', '內用');

-- ============================================================
-- 顧客訂單明細（order_item）
-- ============================================================
INSERT INTO order_item (order_id, item_id, quantity) VALUES
  ('20260517001', 1, 2),   -- 王小明：牛肉麵 x2
  ('20260517001', 3, 1),   -- 王小明：酸辣湯 x1
  ('20260517002', 2, 3),   -- 陳小美：水餃 x3
  ('20260517002', 4, 2),   -- 陳小美：豆漿 x2
  ('20260517003', 6, 1);   -- 張小華：雞腿飯 x1

-- ============================================================
-- 訂購單（purchase_order）— 每張只訂一種食材
-- ============================================================
INSERT INTO purchase_order (order_date, ingredient_id, ordered_qty, received_qty, qualified_qty, unit_price, status) VALUES
  ('2026-05-15', 1, 10, 10, 10, 150, 'received');   -- 排骨：全數到貨合格
INSERT INTO purchase_order (order_date, ingredient_id, ordered_qty, received_qty, qualified_qty, unit_price, status) VALUES
  ('2026-05-15', 2, 20, 20, 20, 40, 'received');    -- 白米：全數到貨合格
INSERT INTO purchase_order (order_date, ingredient_id, ordered_qty, received_qty, qualified_qty, unit_price, status) VALUES
  ('2026-05-16', 4, 15, 13, 11, 120, 'partial');    -- 雞腿：到13斤，合格11斤（2斤退貨）
INSERT INTO purchase_order (order_date, ingredient_id, ordered_qty, received_qty, qualified_qty, unit_price, status) VALUES
  ('2026-05-17', 5, 10, 0, 0, 30, 'ordered');       -- 高麗菜：尚未到貨

-- ============================================================
-- 退貨單（return_order）— 只有部分驗收的那張訂購單有退貨
-- ============================================================
INSERT INTO return_order (po_id, return_date, return_qty, return_reason) VALUES
  (3, '2026-05-16', 2, '2 支雞腿外觀不良');
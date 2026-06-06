'use client'
import { useState, useEffect, useCallback } from 'react'

// ============================================================
// 金濠客食堂 前台點餐頁
// ============================================================
// 食材分類標籤
const PROTEIN_TAGS = ['全部', '豬', '雞', '牛', '魚', '其他']

// 當 API 無法取得時的 fallback（MOCK_MENU item_id 與 DB 不符，訂單會壞
// 這只是避免 UI 完全炸掉，應該確保 API 正常）
const FALLBACK_MENU = [
  { item_id: 1,  name: '大比目魚排便當', sub: '扁鱈', category: '手作便當', tag: '魚',   price: 130, emoji: '🐟' },
  { item_id: 2,  name: '酥炸豬排便當',   category: '手作便當', tag: '豬',   price: 130, emoji: '🐷' },
  { item_id: 3,  name: '酥嫩雞腿便當',   category: '手作便當', tag: '雞',   price: 130, emoji: '🍗' },
  { item_id: 4,  name: '紅麴豬五花便當', category: '手作便當', tag: '豬',   price: 120, emoji: '🐷' },
  { item_id: 5,  name: '酥炸排骨便當',   sub: '無骨',  category: '手作便當', tag: '豬',   price: 100, emoji: '🐷' },
  { item_id: 6,  name: '滷豬腳便當',     category: '手作便當', tag: '豬',   price: 100, emoji: '🐷' },
  { item_id: 7,  name: '滷雞腿便當',     category: '手作便當', tag: '雞',   price: 100, emoji: '🍗' },
  { item_id: 8,  name: '滷排骨便當',     sub: '帶骨·附滷蛋', category: '手作便當', tag: '豬', price: 100, emoji: '🥚' },
  { item_id: 9,  name: '沙茶牛肉燴飯',   category: '燴飯',     tag: '牛',   price: 110, emoji: '🥩', option: '加肉60 / 加菜10' },
  { item_id: 10, name: '沙茶雞柳燴飯',   category: '燴飯',     tag: '雞',   price: 110, emoji: '🍗', option: '加肉60 / 加菜10' },
  { item_id: 11, name: '沙茶豬肉燴飯',   category: '燴飯',     tag: '豬',   price: 100, emoji: '🐷', option: '加肉50 / 加菜10' },
  { item_id: 14, name: '大比目魚排',     sub: '扁鱈',  category: '單點',    tag: '魚',   price: 100, emoji: '🐟' },
  { item_id: 15, name: '酥炸豬排',       category: '單點',    tag: '豬',   price: 100, emoji: '🐷' },
  { item_id: 16, name: '酥嫩雞腿',       category: '單點',    tag: '雞',   price: 100, emoji: '🍗' },
  { item_id: 17, name: '紅麴豬五花',     category: '單點',    tag: '豬',   price: 90,  emoji: '🐷' },
  { item_id: 18, name: '沙茶燴牛肉',     category: '單點',    tag: '牛',   price: 90,  emoji: '🥩', option: '加肉60 / 加菜10' },
  { item_id: 19, name: '滷排骨',         sub: '二片',  category: '單點',    tag: '豬',   price: 80,  emoji: '🐷' },
  { item_id: 20, name: '沙茶燴豬肉',     category: '單點',    tag: '豬',   price: 80,  emoji: '🐷', option: '加肉50 / 加菜10' },
  { item_id: 21, name: '酥炸排骨',         sub: '無骨',  category: '單點',    tag: '豬',   price: 70,  emoji: '🐷' },
  { item_id: 22, name: '滷雞腿',         category: '單點',    tag: '雞',   price: 70,  emoji: '🍗' },
  { item_id: 23, name: '季節炒時蔬',     category: '單點',    tag: '其他', price: 60,  emoji: '🥬' },
  { item_id: 24, name: '白飯',           category: '單點',    tag: '其他', price: 20,  emoji: '🍚' },
  { item_id: 25, name: '滷蛋',           category: '單點',    tag: '其他', price: 15,  emoji: '🥚' },
  { item_id: 26, name: '加購湯品',       category: '單點',    tag: '其他', price: 10,  emoji: '🍜' },
  { item_id: 27, name: '加購菜脯',         sub: '原味/辣味', category: '單點', tag: '其他', price: 5,  emoji: '🥢' },
]

// ============================================================
// 主元件
// ============================================================
export default function CustomerOrderPage() {

  // ---- State ----
  const [menu, setMenu] = useState([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState(null)
  const [activeTag, setActiveTag] = useState('全部')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [customerNote, setCustomerNote] = useState('')
  const [orderDone, setOrderDone] = useState(false)
  const [justOrdered, setJustOrdered] = useState(null)

  // ---- 抓 API 取得真實 item_id ----
  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          setMenu(data.data)
        } else {
          // API 回成功但沒資料，使用 fallback
          setMenu(FALLBACK_MENU)
        }
        setMenuLoading(false)
      })
      .catch(err => {
        console.error('無法取得菜單，使用 fallback：', err)
        setMenu(FALLBACK_MENU)
        setMenuLoading(false)
      })
  }, [])

  // ---- 衍生資料 ----
  const filteredMenu = activeTag === '全部'
    ? menu
    : menu.filter(item => item.tag === activeTag)

  // ---- 函式 ----
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.item_id)
      if (existing) {
        return prev.map(i =>
          i.item_id === item.item_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      // 存完整品項（item_id 是 DB 真實的，不是 MOCK 的）
      return [...prev, {
        item_id: item.item_id,
        name: item.name,
        price: item.price,
        emoji: item.emoji,
        sub: item.sub || '',
        option: item.option || '',
        category: item.category,
        tag: item.tag,
        quantity: 1,
      }]
    })
    setCartOpen(true)
  }

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.item_id !== itemId))
  }

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.item_id === itemId) {
        const newQty = Math.max(0, i.quantity + delta)
        return newQty === 0 ? null : { ...i, quantity: newQty }
      }
      return i
    }).filter(Boolean))
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const handleSubmit = async () => {
    if (cart.length === 0) return alert('購物車是空的')

    const payload = {
      customer_name: '現場顧客',
      customer_phone: '',
      note: customerNote,
      // POST 使用真實的 DB item_id
      items: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!data.success) {
        alert(data.error || '送出失敗')
        return
      }

      setJustOrdered({ orderId: data.data.order_id, items: cart.length, total })
      setOrderDone(true)

      setTimeout(() => {
        setCart([])
        setCustomerNote('')
        setOrderDone(false)
        setCartOpen(false)
      }, 3000)
    } catch (err) {
      alert('連線失敗，請稍後再試')
    }
  }

  // ============================================================
  // JSX
  // ============================================================
  return (
    <div className="flex h-screen overflow-hidden">

      {/* ======== Sidebar ======== */}
      <aside className="w-[220px] bg-ink flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-ink/5">
          <h1 className="text-clay font-display text-xl font-semibold tracking-wide">
            金濠客食堂
          </h1>
          <p className="text-ink-soft text-[11px] mt-1 tracking-wider uppercase font-body">
            Jinhaoke
          </p>
        </div>

        {/* Nav — 前台只有點餐 */}
        <nav className="flex-1 px-3 py-4">
          <div
            className="w-full text-left px-4 py-2.5 rounded-md text-sm text-clay border-l-[3px] border-l-clay bg-clay/10"
          >
            點餐
          </div>
        </nav>
      </aside>

      {/* ======== Main Wrapper ======== */}
      <div
        className="flex-1 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginRight: cartOpen ? '380px' : '0px' }}
      >

        {/* ---- Top Bar ---- */}
        <header className="h-16 bg-cream border-b border-border flex items-center justify-between px-8 shrink-0">
          <h2 className="text-ink font-body font-semibold text-sm tracking-wide">
            點餐
          </h2>

          {/* 食材標籤 */}
          <div className="flex items-center gap-2">
            {PROTEIN_TAGS.map(p => (
              <button
                key={p}
                onClick={() => setActiveTag(p)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-body font-medium transition-all duration-200 ${
                  activeTag === p
                    ? 'bg-clay text-cream'
                    : 'bg-transparent text-ink/60 border border-border hover:border-clay'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <span className="text-sm text-ink/50 font-mono">桌號 · A3</span>
        </header>

        {/* ---- Content ---- */}
        <main className="flex-1 overflow-auto p-8 bg-cream">

          {/* 載入中 */}
          {menuLoading && (
            <div className="flex items-center justify-center h-64">
              <p className="text-ink/30">載入菜單中…</p>
            </div>
          )}

          {/* 類別區塊 */}
          {!menuLoading && ['手作便當', '燴飯', '單點'].map(cat => {
            const catItems = filteredMenu.filter(i => i.category === cat)
            if (catItems.length === 0) return null

            return (
              <section key={cat} className="mb-10">
                <h3 className="text-[13px] font-body font-semibold text-clay uppercase tracking-widest mb-4">
                  {cat}
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
                  {catItems.map(item => (
                    <button
                      key={item.item_id}
                      onClick={() => addToCart(item)}
                      className="card card-hover text-left flex flex-col h-full overflow-hidden"
                    >
                      {/* 圖片區 */}
                      <div className="h-28 bg-clay-soft flex items-center justify-center text-4xl select-none">
                        {item.emoji || '🍱'}
                      </div>

                      {/* 資訊區 */}
                      <div className="p-3 flex flex-col flex-1">
                        <p className="text-sm font-body font-semibold text-ink leading-tight">
                          {item.name}
                        </p>
                        {item.sub && (
                          <p className="text-[11px] text-ink/40 mt-0.5">{item.sub}</p>
                        )}
                        {item.option && (
                          <p className="text-[10px] text-ink/30 mt-0.5">{item.option}</p>
                        )}
                        <p className="font-mono text-[15px] font-bold text-clay mt-auto">
                          NT${item.price}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}

          {/* 載入失敗但有 fallback 資料 */}
          {!menuLoading && menuError && menu.length > 0 && (
            <p className="text-center text-[12px] text-ink/25 mb-4">
              部分資料來自本地快取，即時更新請稍後重整
            </p>
          )}

          {/* 如果過濾後無結果 */}
          {!menuLoading && filteredMenu.length === 0 && (
            <div className="text-center py-20 text-ink/30">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-sm">此分類尚無餐點</p>
            </div>
          )}
        </main>
      </div>

{/* ======== Cart FAB（右下浮動按鈕） ======== */}
      {!cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed right-6 bottom-6 w-14 h-14 bg-clay hover:bg-clay-deep text-cream rounded-full flex items-center justify-center text-2xl shadow-card transition-all duration-200 z-50"
        >
          🛒
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-warn text-cream text-[11px] font-bold rounded-full flex items-center justify-center">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      )}

      {/* ======== Cart Panel（永遠在 DOM，用 translateX 控制進出） ======== */}
      <div
        className="fixed top-0 right-0 h-screen w-[380px] bg-cream shadow-card-hover flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ transform: cartOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Cart Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-body font-semibold text-ink text-sm">目前點餐</h3>
          <button
            onClick={() => setCartOpen(false)}
            className="w-8 h-8 rounded-full bg-clay-soft hover:bg-border text-ink flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-16 text-ink/25">
              <p className="text-4xl mb-2">🍱</p>
              <p className="text-sm">尚未選取餐點</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.item_id} className="flex items-center gap-3 bg-clay-soft rounded-lg p-3">
                <span className="text-2xl shrink-0">{item.emoji || '🍱'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-ink truncate">
                    {item.name}
                  </p>
                  <p className="font-mono text-[13px] text-clay font-bold">
                    NT${item.price}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.item_id, -1)}
                    className="w-6 h-6 rounded-full bg-paper border border-border text-ink/50 hover:text-ink flex items-center justify-center text-xs">−</button>
                  <span className="w-5 text-center font-mono text-sm font-medium text-ink">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.item_id, 1)}
                    className="w-6 h-6 rounded-full bg-clay text-cream hover:bg-clay-deep flex items-center justify-center text-xs transition-colors">+</button>
                </div>
                <button
                  onClick={() => removeFromCart(item.item_id)}
                  className="text-ink/25 hover:text-warn text-sm ml-1 transition-colors">✕</button>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-border bg-clay-soft px-6 py-4 shrink-0">
          {/* 備註 */}
          <textarea
            placeholder="備註：外帶、不要辣…"
            value={customerNote}
            onChange={e => setCustomerNote(e.target.value)}
            rows={2}
            className="w-full bg-paper border border-border rounded-md px-3 py-2 text-[13px] font-body text-ink placeholder-ink/25 resize-none focus:outline-none focus:border-clay mb-4"
          />

          {/* 總計 */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-ink/60 font-body">
              共 {cart.reduce((s, i) => s + i.quantity, 0)} 項
            </span>
            <p className="font-mono text-lg font-bold text-clay">
              NT$ {total}
            </p>
          </div>

          {/* 送出 */}
          <button
            onClick={handleSubmit}
            disabled={cart.length === 0}
            className="w-full bg-clay hover:bg-clay-deep disabled:opacity-30 disabled:cursor-not-allowed text-cream font-body font-semibold text-sm py-3 rounded-md transition-colors duration-200"
          >
            送出訂單
          </button>
        </div>
      </div>

      {/* ======== 成功彈窗 ======== */}
      {orderDone && justOrdered && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50">
          <div className="bg-cream rounded-lg p-8 text-center max-w-sm mx-4 shadow-card-hover">
            <div className="w-16 h-16 bg-moss-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-moss">✓</span>
            </div>
            <h2 className="font-display text-xl text-ink mb-2">訂單成立</h2>
            <p className="font-mono text-[11px] text-ink/40 mb-4">
              #{justOrdered.orderId}
            </p>
            <div className="bg-clay-soft rounded-md p-4 mb-4">
              <p className="text-[13px] text-ink/60">{justOrdered.items} 項商品</p>
              <p className="font-mono text-xl font-bold text-clay mt-1">
                NT$ {justOrdered.total}
              </p>
            </div>
            <p className="text-[12px] text-ink/30">請稍候，正在準備餐點</p>
          </div>
        </div>
      )}
    </div>
  )
}
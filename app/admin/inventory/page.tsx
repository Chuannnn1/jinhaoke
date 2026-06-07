'use client'
import { useState, useEffect, useCallback } from 'react'

// ============================================================
// 庫存管理頁面 — 串接 /api/inventory
// ============================================================

interface InventoryItem {
  name: string
  stock_qty: number
  safety_stock: number
  stock_unit: string
  order_unit: string
  qty_per_order_unit: number
  supplier_name: string | null
}

const CATEGORIES = ['全部', '肉類', '海鮮', '乾貨', '調味料', '耗材']

// 手動對應分類（正式系統應由 category 欄位決定）
// 這裡先用常見關鍵字做簡單分類
function guessCategory(name: string): string {
  const n = name.toLowerCase()
  if (/魚|鱈|蝦|蟹|干貝|海/.test(n)) return '海鮮'
  if (/肉|排|腿|片|豬|雞|牛|五花|炸/.test(n)) return '肉類'
  if (/醬|油|鹽|糖|沙茶|紅麴|滷包/.test(n)) return '調味料'
  if (/米|蛋|蔬|菜脯|便當|筷|盒/.test(n)) return '乾貨'
  return '耗材'
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('全部')
  const [search, setSearch] = useState('')

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      if (data.success) {
        setInventory(data.data)
      } else {
        setError(data.error || '讀取失敗')
      }
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // 過濾
  const filtered = inventory.filter(item => {
    const cat = guessCategory(item.name)
    const matchCategory = activeCategory === '全部' || cat === activeCategory
    const matchSearch = search === '' || item.name.includes(search)
    return matchCategory && matchSearch
  })

  // 狀態標籤
  const getStatus = (stock: number, safe: number) => {
    if (safe <= 0) return { label: '—', color: 'bg-gray-100 text-gray-500' }
    if (stock <= safe * 0.5) return { label: '不足', color: 'bg-red-100 text-red-700' }
    if (stock <= safe) return { label: '偏低', color: 'bg-yellow-100 text-yellow-700' }
    return { label: '充足', color: 'bg-green-100 text-green-700' }
  }

  // 統計
  const totalItems = inventory.length
  const lowStockCount = inventory.filter(i => i.safety_stock > 0 && i.stock_qty <= i.safety_stock).length
  const criticalCount = inventory.filter(i => i.safety_stock > 0 && i.stock_qty <= i.safety_stock * 0.5).length

  return (
    <>
      <header className="h-16 bg-cream border-b border-gold-200 flex items-center justify-between px-8 shrink-0">
        <h2 className="text-charcoal-900 font-body font-semibold text-sm tracking-wide">
          庫存管理
        </h2>
        <button
          onClick={fetchInventory}
          className="text-[12px] text-charcoal-900/40 hover:text-gold-500 transition-colors font-mono"
        >
          重新整理
        </button>
      </header>

      <main className="flex-1 overflow-auto p-6 bg-gold-50">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-charcoal-900/30">載入中…</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <>
              {/* 摘要卡片 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                  <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">總品項</span>
                  <p className="text-2xl font-bold text-charcoal-900 mt-1">{totalItems}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                  <span className="text-xs text-yellow-600 uppercase tracking-wide">庫存偏低</span>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{lowStockCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                  <span className="text-xs text-red-600 uppercase tracking-wide">庫存不足</span>
                  <p className="text-2xl font-bold text-red-600 mt-1">{criticalCount}</p>
                </div>
              </div>

              {/* 搜尋 + 分類 */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="搜尋品名…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="px-3 py-2 border border-gold-200 rounded-lg text-sm w-64 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        activeCategory === cat
                          ? 'bg-gold-500 text-white'
                          : 'bg-white text-charcoal-900/60 border border-gold-200 hover:bg-gold-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 庫存表格 */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gold-50 text-charcoal-900/50 text-left text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">品名</th>
                      <th className="px-4 py-3 font-medium text-right">目前庫存</th>
                      <th className="px-4 py-3 font-medium text-right">安全存量</th>
                      <th className="px-4 py-3 font-medium text-center">狀態</th>
                      <th className="px-4 py-3 font-medium">分類</th>
                      <th className="px-4 py-3 font-medium">供應商</th>
                      <th className="px-4 py-3 font-medium text-right">叫貨單位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => {
                      const status = getStatus(item.stock_qty, item.safety_stock)
                      const cat = guessCategory(item.name)
                      return (
                        <tr
                          key={item.name}
                          className={`border-t border-gold-100 hover:bg-gold-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gold-50/20'}`}
                        >
                          <td className="px-4 py-3 font-medium text-charcoal-900">{item.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-charcoal-900">
                            {item.stock_qty} <span className="text-charcoal-900/40 text-xs">{item.stock_unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-charcoal-900/40 font-mono">
                            {item.safety_stock} <span className="text-charcoal-900/30 text-xs">{item.stock_unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-charcoal-900/50 text-xs">{cat}</td>
                          <td className="px-4 py-3 text-charcoal-900/50 text-xs">{item.supplier_name ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-charcoal-900/40 text-xs">
                            {item.order_unit}（{item.qty_per_order_unit} {item.stock_unit}/{item.order_unit}）
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filtered.length === 0 && (
                  <div className="text-center py-12 text-charcoal-900/30">
                    {inventory.length === 0 ? '尚無庫存資料' : '沒有符合的品項'}
                  </div>
                )}
              </div>
            </>
          )}
      </main>
    </>
  )
}
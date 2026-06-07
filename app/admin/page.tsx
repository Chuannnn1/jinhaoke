'use client'
import { useState, useEffect, useCallback } from 'react'

// DB 裡的 status 是中文，這裡的 key 必須對應到 DB 值
// 前端 UI 顯示「待製作/製作中/待付款/已完成/已取消」，傳給 API 時用英文
// 五個狀態：待製作 / 製作中 / 待付款 / 已完成 / 已取消
const COLUMNS = [
  { key: 'pending',          label: '待製作',  color: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-400 text-white' },
  { key: 'preparing',        label: '製作中',  color: 'bg-blue-50 border-blue-200',      badge: 'bg-blue-500 text-white' },
  { key: 'awaiting_payment', label: '待付款',  color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500 text-white' },
  { key: 'done',             label: '已完成',  color: 'bg-green-50 border-green-200',   badge: 'bg-green-500 text-white' },
  { key: 'cancelled',        label: '已取消',  color: 'bg-red-50 border-red-200',        badge: 'bg-red-400 text-white' },
]

// DB 中文 status → 前端英文 key（用於分類顯示）
const statusToKey: Record<string, string> = {
  '待製作':  'pending',
  '製作中':  'preparing',
  '待付款':  'awaiting_payment',
  '已完成':  'done',
  '已取消':  'cancelled',
}

export default function AdminOrderPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOverCol, setDragOverCol] = useState(null)

  // 初次載入從 API 撈訂單
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders')
      const data = await res.json()
      if (data.success) {
        setOrders(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    // 每 10 秒自動更新
    const interval = setInterval(fetchOrders, 10000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  // 拖曳放下去 -> 更新訂單狀態
  const handleDrop = useCallback(async (e, targetStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    const orderId = e.dataTransfer.getData('text/plain')
    const order = orders.find(o => o.order_id === orderId)
    if (!order) return

    // 樂觀更新 UI
    setOrders(prev => prev.map(o =>
      o.order_id === orderId ? { ...o, status: targetStatus } : o
    ))

    // 呼叫 API（傳英文 key，API 會轉成中文）
    try {
      const res = await fetch('/api/orders/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: targetStatus }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '更新失敗')
        fetchOrders() // 失敗時重撈復原
      }
    } catch (err) {
      console.error('Failed to update order status:', err)
      fetchOrders()
    }
  }, [orders, fetchOrders])

  const handleDragOver = (e, colKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDragStart = (e, orderId) => {
    e.dataTransfer.setData('text/plain', orderId)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <>
      <header className="h-16 bg-cream border-b border-gold-200 flex items-center justify-between px-8 shrink-0">
        <h2 className="text-charcoal-900 font-body font-semibold text-sm tracking-wide">
          當日訂單
        </h2>
        <span className="text-[12px] text-charcoal-900/30 font-mono">
          每 10 秒自動更新
        </span>
      </header>

      <main className="flex-1 overflow-auto p-6 bg-gold-50">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-charcoal-900/30">載入中…</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4 h-full">
              {COLUMNS.map(col => {
                const colOrders = orders.filter(o =>
                  statusToKey[o.status] === col.key
                )
                return (
                  <div
                    key={col.key}
                    onDragOver={e => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, col.key)}
                    className={`flex flex-col rounded-xl border-2 transition-all duration-200 ${
                      dragOverCol === col.key
                        ? `${col.color} border-dashed border-2 border-gold-400`
                        : `${col.color} border-solid`
                    }`}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3 shrink-0">
                      <span className={`text-sm font-semibold font-body ${col.key === 'done' ? 'text-success' : 'text-charcoal-900'}`}>
                        {col.label}
                      </span>
                      <span className={`w-6 h-6 rounded-full ${col.badge} text-[11px] font-bold flex items-center justify-center`}>
                        {colOrders.length}
                      </span>
                    </div>

                    {/* Orders */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                      {colOrders.length === 0 ? (
                        <p className="text-center text-[12px] text-charcoal-900/20 py-8">
                          暫無訂單
                        </p>
                      ) : (
                        colOrders.map(order => (
                          <div
                            key={order.order_id}
                            draggable
                            onDragStart={e => handleDragStart(e, order.order_id)}
                            className="bg-white rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-mono text-[12px] font-semibold text-charcoal-900">
                                #{order.order_id}
                              </p>
                              <p className="text-[11px] text-charcoal-900/30 font-mono">
                                {order.created_at ? order.created_at.slice(11, 16) : ''}
                              </p>
                            </div>
                            <p className="text-[12px] text-charcoal-900/60 mb-1">
                              {order.items?.length ?? 0} 項 · <span className="font-mono text-gold-500 font-semibold">NT$ {order.total ?? 0}</span>
                            </p>
                            {order.note && (
                              <p className="text-[11px] text-charcoal-900/30 italic truncate">
                                {order.note}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </main>
    </>
  )
}
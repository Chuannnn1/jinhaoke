'use client'
import { useState, useEffect, useCallback } from 'react'

interface DailyReport {
  date: string
  orders_count: number
  total_revenue: number
  top_items: Array<{ name: string; qty: number; revenue: number }>
}

interface MonthlyReport {
  year: number
  month: number
  orders_count: number
  total_revenue: number
  avg_per_order: number
}

function formatMoney(n: number) {
  return n.toLocaleString('zh-TW')
}

function getRecentDates(days: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function getRecentMonths(count: number): Array<{ year: number; month: number; label: string }> {
  const months: Array<{ year: number; month: number; label: string }> = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return months
}

export default function ReportsPage() {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily')

  const [dailyData, setDailyData] = useState<DailyReport[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyReport[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDaily = useCallback(async () => {
    const dates = getRecentDates(14)
    const results = await Promise.all(
      dates.map(async (date) => {
        try {
          const res = await fetch(`/api/reports/daily?date=${date}`)
          const data = await res.json()
          if (data.success && data.data) return data.data as DailyReport
          return { date, orders_count: 0, total_revenue: 0, top_items: [] } as DailyReport
        } catch {
          return { date, orders_count: 0, total_revenue: 0, top_items: [] } as DailyReport
        }
      })
    )
    setDailyData(results)
  }, [])

  const fetchMonthly = useCallback(async () => {
    const months = getRecentMonths(6)
    const results = await Promise.all(
      months.map(async ({ year, month }) => {
        try {
          const res = await fetch(`/api/reports/monthly?year=${year}&month=${month}`)
          const data = await res.json()
          if (data.success && data.data) return data.data as MonthlyReport
          return { year, month, orders_count: 0, total_revenue: 0, avg_per_order: 0 } as MonthlyReport
        } catch {
          return { year, month, orders_count: 0, total_revenue: 0, avg_per_order: 0 } as MonthlyReport
        }
      })
    )
    setMonthlyData(results)
  }, [])

  useEffect(() => {
    Promise.all([fetchDaily(), fetchMonthly()]).finally(() => setLoading(false))
  }, [fetchDaily, fetchMonthly])

  const maxDailyRev = Math.max(...dailyData.map(d => d.total_revenue), 1)
  const maxMonthlyRev = Math.max(...monthlyData.map(d => d.total_revenue), 1)

  const todayReport = dailyData[0]

  return (
    <>
      <header className="h-16 bg-cream border-b border-gold-200 flex items-center justify-between px-8 shrink-0">
        <h2 className="text-charcoal-900 font-body font-semibold text-sm tracking-wide">
          報表
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === 'daily' ? 'bg-gold-500 text-white' : 'bg-white text-charcoal-900/50 border border-gold-200'
            }`}
          >
            每日
          </button>
          <button
            onClick={() => setTab('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === 'monthly' ? 'bg-gold-500 text-white' : 'bg-white text-charcoal-900/50 border border-gold-200'
            }`}
          >
            每月
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 bg-gold-50">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-charcoal-900/30">載入中…</p>
          </div>
        ) : tab === 'daily' ? (
          <>
            {/* Daily stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">今日營收</span>
                <p className="text-2xl font-bold text-charcoal-900 font-mono mt-1">
                  NT$ {formatMoney(todayReport?.total_revenue ?? 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">今日訂單</span>
                <p className="text-2xl font-bold text-charcoal-900 mt-1">
                  {todayReport?.orders_count ?? 0}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">近 14 日平均</span>
                <p className="text-2xl font-bold text-charcoal-900 font-mono mt-1">
                  NT$ {formatMoney(
                    Math.round(dailyData.reduce((s, d) => s + d.total_revenue, 0) / dailyData.length) || 0
                  )}
                </p>
              </div>
            </div>

            {/* Daily bar chart */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <p className="text-xs text-charcoal-900/40 uppercase tracking-wide mb-4">近 14 日營收</p>
              <div className="flex items-end gap-2 h-48">
                {[...dailyData].reverse().map(d => {
                  const pct = maxDailyRev > 0 ? (d.total_revenue / maxDailyRev) * 100 : 0
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-charcoal-900/40 font-mono">
                        {d.total_revenue > 0 ? formatMoney(d.total_revenue) : ''}
                      </span>
                      <div
                        className="w-full bg-gold-400 rounded-t-md transition-all duration-300 min-h-[2px]"
                        style={{ height: `${Math.max(pct, 1)}%` }}
                      />
                      <span className="text-[9px] text-charcoal-900/30 font-mono">{d.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Today top items */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-charcoal-900/40 uppercase tracking-wide mb-4">今日暢銷品項</p>
              {todayReport?.top_items && todayReport.top_items.length > 0 ? (
                <div className="space-y-2">
                  {todayReport.top_items.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? 'bg-gold-400 text-white' :
                        i === 1 ? 'bg-charcoal-300 text-white' :
                        i === 2 ? 'bg-amber-300 text-white' :
                        'bg-gold-100 text-charcoal-900/40'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-charcoal-900">{item.name}</span>
                      <span className="text-xs text-charcoal-900/40 font-mono">{item.qty} 份</span>
                      <span className="text-xs text-gold-500 font-mono">NT$ {formatMoney(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-charcoal-900/30 text-sm">今日尚無資料</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Monthly stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">本月營收</span>
                <p className="text-2xl font-bold text-charcoal-900 font-mono mt-1">
                  NT$ {formatMoney(monthlyData[0]?.total_revenue ?? 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">本月訂單</span>
                <p className="text-2xl font-bold text-charcoal-900 mt-1">
                  {monthlyData[0]?.orders_count ?? 0}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-charcoal-900/40 uppercase tracking-wide">本月均單</span>
                <p className="text-2xl font-bold text-charcoal-900 font-mono mt-1">
                  NT$ {formatMoney(monthlyData[0]?.avg_per_order ?? 0)}
                </p>
              </div>
            </div>

            {/* Monthly bar chart */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <p className="text-xs text-charcoal-900/40 uppercase tracking-wide mb-4">近 6 個月營收</p>
              <div className="flex items-end gap-4 h-48">
                {[...monthlyData].reverse().map(d => {
                  const pct = maxMonthlyRev > 0 ? (d.total_revenue / maxMonthlyRev) * 100 : 0
                  const label = `${d.year}-${String(d.month).padStart(2, '0')}`
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-charcoal-900/40 font-mono">
                        {d.total_revenue > 0 ? formatMoney(d.total_revenue) : ''}
                      </span>
                      <div
                        className="w-full bg-gold-500 rounded-t-md transition-all duration-300 min-h-[2px]"
                        style={{ height: `${Math.max(pct, 1)}%` }}
                      />
                      <span className="text-[10px] text-charcoal-900/30 font-mono">{label.slice(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Monthly table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gold-50 text-charcoal-900/50 text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">月份</th>
                    <th className="px-4 py-3 font-medium text-right">訂單數</th>
                    <th className="px-4 py-3 font-medium text-right">營收</th>
                    <th className="px-4 py-3 font-medium text-right">均單</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((d, idx) => {
                    const label = `${d.year}-${String(d.month).padStart(2, '0')}`
                    return (
                      <tr
                        key={label}
                        className={`border-t border-gold-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gold-50/20'}`}
                      >
                        <td className="px-4 py-3 font-medium text-charcoal-900">{label}</td>
                        <td className="px-4 py-3 text-right text-charcoal-900 font-mono">{d.orders_count}</td>
                        <td className="px-4 py-3 text-right text-gold-600 font-mono font-semibold">
                          NT$ {formatMoney(d.total_revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-charcoal-900/50 font-mono">
                          NT$ {formatMoney(d.avg_per_order)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}

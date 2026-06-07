'use client'
import { useState, useEffect, useCallback } from 'react'

interface MenuItem {
  item_id: number
  name: string
  category: string
  price: number
  emoji: string
  tag: string
  sub: string
  option: string
  description: string
  is_active: number
}

type FormData = {
  name: string
  category: string
  price: number
  emoji: string
  tag: string
  sub: string
  option: string
  description: string
}

const CATEGORIES = ['全部', '便當', '單點', '飲料']
const MENU_CATEGORIES = ['便當', '單點', '飲料']

const EMPTY_FORM: FormData = {
  name: '',
  category: '便當',
  price: 0,
  emoji: '',
  tag: '',
  sub: '',
  option: '',
  description: '',
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('全部')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchMenu = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/menu')
      const data = await res.json()
      if (data.success) setItems(data.data)
      else setError(data.error || '讀取失敗')
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  const filtered = items.filter(item => {
    const matchCat = activeCategory === '全部' || item.category === activeCategory
    const matchSearch = search === '' || item.name.includes(search)
    return matchCat && matchSearch
  })

  const totalItems = items.length
  const categoryCount = new Set(items.map(i => i.category)).size

  const openNew = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditTarget(item)
    setForm({
      name: item.name,
      category: item.category,
      price: item.price,
      emoji: item.emoji,
      tag: item.tag,
      sub: item.sub,
      option: item.option,
      description: item.description,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditTarget(null)
    setFormError(null)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.category || form.price <= 0) {
      setFormError('品名、分類、價格為必填，價格需大於 0')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const url = editTarget ? `/api/menu/${editTarget.item_id}` : '/api/menu'
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, is_active: 1 }),
      })
      const data = await res.json()
      if (data.success) {
        closeModal()
        fetchMenu()
      } else {
        setFormError(data.error || '儲存失敗')
      }
    } catch {
      setFormError('網路錯誤')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: MenuItem) => {
    if (!window.confirm(`確定要下架「${item.name}」？`)) return
    try {
      const res = await fetch(`/api/menu/${item.item_id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchMenu()
    } catch {
      // silent
    }
  }

  return (
    <>
      <header className="h-16 bg-white border-b border-border flex items-center justify-between px-8 shrink-0">
        <h2 className="text-ink font-body font-semibold text-sm tracking-wide">
          菜單管理
          </h2>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-clay-deep transition-colors font-medium"
          >
            + 新增品項
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-ink/30">載入中…</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                  <span className="text-xs text-ink/40 uppercase tracking-wide">上架品項</span>
                  <p className="text-2xl font-bold text-ink mt-1">{totalItems}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                  <span className="text-xs text-ink/40 uppercase tracking-wide">分類數</span>
                  <p className="text-2xl font-bold text-ink mt-1">{categoryCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                  <span className="text-xs text-ink/40 uppercase tracking-wide">篩選顯示</span>
                  <p className="text-2xl font-bold text-ink mt-1">{filtered.length}</p>
                </div>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="搜尋品名…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm w-64 bg-white focus:outline-none focus:ring-2 focus:ring-clay"
                />
                <div className="flex gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        activeCategory === cat
                          ? 'bg-gray-500 text-white'
                          : 'bg-white text-ink/60 border border-border hover:bg-gray-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-ink/50 text-left text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium w-10 text-center"></th>
                      <th className="px-4 py-3 font-medium">品名</th>
                      <th className="px-4 py-3 font-medium">分類</th>
                      <th className="px-4 py-3 font-medium">標籤</th>
                      <th className="px-4 py-3 font-medium text-right">價格</th>
                      <th className="px-4 py-3 font-medium">副標 / 選項</th>
                      <th className="px-4 py-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr
                        key={item.item_id}
                        className={`border-t border-gray-200 hover:bg-gray-50/50 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'
                        }`}
                      >
                        <td className="px-4 py-3 text-xl text-center leading-none">{item.emoji || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-ink">{item.name}</span>
                          {item.description && (
                            <p className="text-xs text-ink/40 mt-0.5 truncate max-w-[180px]">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-clay-soft text-clay font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink/50 text-xs">{item.tag || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                          ${item.price}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink/50">
                          {[item.sub, item.option].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="px-3 py-1 text-xs rounded-md border border-border text-clay hover:bg-gray-50 transition-colors"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="px-3 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              下架
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtered.length === 0 && (
                  <div className="text-center py-12 text-ink/30">
                    {items.length === 0 ? '尚無品項' : '沒有符合的品項'}
                  </div>
                )}
              </div>
            </>
          )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-ink text-base">
                {editTarget ? `編輯「${editTarget.name}」` : '新增品項'}
              </h3>
              <button
                onClick={closeModal}
                className="text-ink/40 hover:text-ink text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* emoji + name */}
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="text-xs text-ink/50 mb-1 block">Emoji</label>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="🍱"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-clay"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-ink/50 mb-1 block">
                    品名 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="酥炸豬排便當"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clay"
                  />
                </div>
              </div>

              {/* category + price */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-ink/50 mb-1 block">
                    分類 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-clay"
                  >
                    {MENU_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs text-ink/50 mb-1 block">
                    價格 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                    min={1}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-clay"
                  />
                </div>
              </div>

              {/* tag */}
              <div>
                <label className="text-xs text-ink/50 mb-1 block">標籤</label>
                <input
                  type="text"
                  value={form.tag}
                  onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder="豬、雞、魚…"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clay"
                />
              </div>

              {/* sub + option */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-ink/50 mb-1 block">副標題</label>
                  <input
                    type="text"
                    value={form.sub}
                    onChange={e => setForm(f => ({ ...f, sub: e.target.value }))}
                    placeholder="扁鱈"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clay"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-ink/50 mb-1 block">選項</label>
                  <input
                    type="text"
                    value={form.option}
                    onChange={e => setForm(f => ({ ...f, option: e.target.value }))}
                    placeholder="加辣+10"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clay"
                  />
                </div>
              </div>

              {/* description */}
              <div>
                <label className="text-xs text-ink/50 mb-1 block">描述</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="簡短說明…"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-clay"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-ink/50 hover:text-ink transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-clay-deep transition-colors font-medium disabled:opacity-50"
              >
                {submitting ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

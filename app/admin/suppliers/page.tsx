'use client'
import { useState, useEffect, useCallback } from 'react'

interface Supplier {
  name: string
  phone: string | null
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      if (data.success) setSuppliers(data.data)
      else setError(data.error || '讀取失敗')
    } catch {
      setError('網路錯誤')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const filtered = suppliers.filter(s =>
    search === '' || s.name.includes(search) || (s.phone && s.phone.includes(search))
  )

  const openNew = () => {
    setEditTarget(null)
    setFormName('')
    setFormPhone('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditTarget(s)
    setFormName(s.name)
    setFormPhone(s.phone ?? '')
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditTarget(null)
    setFormError(null)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      setFormError('供應商名稱為必填')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (editTarget) {
        const res = await fetch(`/api/suppliers/${encodeURIComponent(editTarget.name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formPhone }),
        })
        const data = await res.json()
        if (!data.success) { setFormError(data.error || '更新失敗'); return }
      } else {
        const res = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), phone: formPhone.trim() || undefined }),
        })
        const data = await res.json()
        if (!data.success) { setFormError(data.error || '新增失敗'); return }
      }
      closeModal()
      fetchSuppliers()
    } catch {
      setFormError('網路錯誤')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (s: Supplier) => {
    if (!window.confirm(`確定要刪除「${s.name}」？\n該供應商的食材會變成無供應商。`)) return
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(s.name)}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchSuppliers()
    } catch { /* silent */ }
  }

  return (
    <>
      <header className="h-16 bg-white border-b border-border flex items-center justify-between px-8 shrink-0">
        <h2 className="text-ink font-body font-semibold text-sm tracking-wide">
          供應商管理
        </h2>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-clay-deep transition-colors font-medium"
        >
          + 新增供應商
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
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-ink/40 uppercase tracking-wide">供應商總數</span>
                <p className="text-2xl font-bold text-ink mt-1">{suppliers.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm px-5 py-4">
                <span className="text-xs text-ink/40 uppercase tracking-wide">篩選顯示</span>
                <p className="text-2xl font-bold text-ink mt-1">{filtered.length}</p>
              </div>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="搜尋名稱或電話…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm w-64 bg-white focus:outline-none focus:ring-2 focus:ring-clay"
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-ink/50 text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">名稱</th>
                    <th className="px-4 py-3 font-medium">電話</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr
                      key={s.name}
                      className={`border-t border-gray-200 hover:bg-gray-50/50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                      <td className="px-4 py-3 text-ink/50 font-mono text-xs">{s.phone || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="px-3 py-1 text-xs rounded-md border border-border text-clay hover:bg-gray-50 transition-colors"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="px-3 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-ink/30">
                  {suppliers.length === 0 ? '尚無供應商' : '沒有符合的結果'}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-ink text-base">
                {editTarget ? `編輯「${editTarget.name}」` : '新增供應商'}
              </h3>
              <button onClick={closeModal} className="text-ink/40 hover:text-ink text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs text-ink/50 mb-1 block">
                  名稱 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  disabled={!!editTarget}
                  placeholder="肉品大王"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clay disabled:bg-gray-50 disabled:text-ink/40"
                />
                {editTarget && (
                  <p className="text-[11px] text-ink/30 mt-1">名稱為主鍵，無法修改</p>
                )}
              </div>
              <div>
                <label className="text-xs text-ink/50 mb-1 block">電話</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="05-2200001"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clay"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-ink/50 hover:text-ink transition-colors">
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

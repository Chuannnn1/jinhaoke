'use client'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: '概覽',     href: '/admin/dashboard' },
  { label: '當日訂單', href: '/admin' },
  { label: '庫存',     href: '/admin/inventory' },
  { label: '菜單管理', href: '/admin/menu' },
  { label: '採購',     href: '/admin/purchase-orders' },
  { label: '供應商',   href: '/admin/suppliers' },
  { label: '報表',     href: '/admin/reports' },
]

export default function AdminLayout({ children }) {
  const pathname = usePathname()

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[220px] bg-charcoal-900 flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-white/5">
          <h1 className="text-gold-400 font-display text-xl font-semibold tracking-wide">
            金濠客食堂
          </h1>
          <p className="text-charcoal-700 text-[11px] mt-1 tracking-wider uppercase font-body">
            Jinhaoke
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <a
              key={item.label}
              href={item.href}
              className={`block px-4 py-2.5 rounded-md text-sm transition-all duration-200 border-l-[3px] ${
                isActive(item.href)
                  ? 'text-gold-400 border-l-gold-400 bg-gold-400/10'
                  : 'text-white/65 border-l-transparent hover:text-white/90 hover:bg-charcoal-800'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

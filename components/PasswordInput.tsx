// components/PasswordInput.tsx
// 密碼欄位 + 右側小眼睛 icon：按住才顯示明文、放開回隱藏。
// 行為：
//   · mousedown / touchstart → 顯示
//   · mouseup / mouseleave / touchend → 隱藏
//   · button 不搶 focus（tabIndex=-1）
'use client'
import { useState, InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  id: string
}

export default function PasswordInput({ label, id, className, ...inputProps }: Props) {
  const [reveal, setReveal] = useState(false)
  const hide = () => setReveal(false)
  const show = () => setReveal(true)

  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-xs text-ink-mute uppercase tracking-wider block mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={reveal ? 'text' : 'password'}
          className={
            'w-full px-3 pr-10 py-2 border border-border rounded-lg text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-clay ' +
            (className ?? '')
          }
          {...inputProps}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="按住顯示密碼"
          title="按住顯示密碼"
          onMouseDown={(e) => { e.preventDefault(); show() }}
          onMouseUp={hide}
          onMouseLeave={hide}
          onTouchStart={show}
          onTouchEnd={hide}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-mute hover:text-ink select-none leading-none"
        >
          {reveal ? EyeOffSvg : EyeSvg}
        </button>
      </div>
    </div>
  )
}

const EyeSvg = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffSvg = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

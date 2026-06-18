#!/usr/bin/env node
// scripts/sqlite-viewer.js
// Lightweight SQLite web viewer on port 3200
// Usage: node scripts/sqlite-viewer.js [db_path]
const http = require('http')
const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.argv[2] || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'jinhaoke.db')
const PORT = 3200
const db = new Database(DB_PATH, { readonly: true })
db.pragma('journal_mode = WAL')

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name)

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function renderTable(columns, rows) {
  let h = '<table><thead><tr>'
  for (const c of columns) h += `<th>${escapeHtml(c)}</th>`
  h += '</tr></thead><tbody>'
  for (const row of rows) {
    h += '<tr>'
    for (const c of columns) {
      const v = row[c]
      h += `<td>${v === null ? '<span class="null">NULL</span>' : escapeHtml(v)}</td>`
    }
    h += '</tr>'
  }
  h += '</tbody></table>'
  return h
}

function page(body, query) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SQLite Viewer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans TC', -apple-system, sans-serif; background: #FAFAF8; color: #1A1A1A; padding: 24px; }
  h1 { font-size: 18px; color: #A44A17; margin-bottom: 16px; }
  .db-path { font-size: 12px; color: #888; margin-bottom: 20px; font-family: monospace; }
  .tables { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  .tables a { padding: 4px 12px; background: #FFF3EB; border: 1px solid #C65D21; border-radius: 20px; text-decoration: none; color: #C65D21; font-size: 13px; }
  .tables a:hover { background: #C65D21; color: white; }
  form { margin-bottom: 20px; display: flex; gap: 8px; }
  textarea { flex: 1; min-height: 60px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 13px; resize: vertical; }
  button { padding: 10px 24px; background: #C65D21; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
  button:hover { background: #A44A17; }
  .result { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th { background: #f5f0eb; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #888; border-bottom: 2px solid #e5ddd4; white-space: nowrap; }
  td { padding: 6px 12px; border-bottom: 1px solid #f0ece6; font-family: monospace; font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr:hover td { background: #FFF3EB; }
  .null { color: #ccc; font-style: italic; }
  .meta { font-size: 12px; color: #888; margin-bottom: 10px; }
  .error { color: #d44030; background: #fff0f0; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
</style></head><body>
<h1>金濠客 SQLite Viewer</h1>
<p class="db-path">${escapeHtml(DB_PATH)}</p>
<div class="tables">${tables.map(t => `<a href="/?q=${encodeURIComponent('SELECT * FROM "'+t+'" LIMIT 100')}">${escapeHtml(t)}</a>`).join('')}</div>
<form method="GET">
  <textarea name="q" placeholder="SELECT * FROM &quot;order&quot; LIMIT 50">${escapeHtml(query || '')}</textarea>
  <button type="submit">Run</button>
</form>
${body}
</body></html>`
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const query = url.searchParams.get('q') || ''

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

  if (!query) {
    res.end(page('', ''))
    return
  }

  try {
    const trimmed = query.trim()
    if (/^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)/i.test(trimmed)) {
      res.end(page('<p class="error">唯讀模式：僅允許 SELECT 查詢</p>', query))
      return
    }
    const stmt = db.prepare(trimmed)
    const rows = stmt.all()
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    const meta = `<p class="meta">${rows.length} 筆結果</p>`
    res.end(page(meta + renderTable(columns, rows), query))
  } catch (err) {
    res.end(page(`<p class="error">${escapeHtml(err.message)}</p>`, query))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SQLite Viewer running at http://localhost:${PORT}`)
  console.log(`DB: ${DB_PATH}`)
  console.log(`Tables: ${tables.join(', ')}`)
})

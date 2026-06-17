// 一次性轉檔 script：把使用者下載的招牌 jpg 轉成 webp 放 public/brand/
const sharp = require('sharp')
const path = require('path')

const src = process.argv[2]
const out = process.argv[3]
if (!src || !out) {
  console.error('usage: node convert-logo.js <src> <out>')
  process.exit(1)
}

sharp(src)
  .resize({ width: 512, withoutEnlargement: true })
  .webp({ quality: 88 })
  .toFile(out)
  .then(info => console.log('OK', info))
  .catch(err => { console.error(err); process.exit(1) })

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  PORT = 4000,
  JWT_SECRET = 'dev_secret',
  ADMIN_USER = 'admin',
  ADMIN_PASS = 'admin123',
  DATA_FILE = path.join(__dirname, '..', 'data', 'books.json'),
  SOURCE_BASE = 'http://localhost:4200',
} = process.env;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
// uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
await fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});
app.use('/uploads', express.static(uploadsDir));
function extFromMime(mime) {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/svg+xml':
      return '.svg';
    case 'application/pdf':
      return '.pdf';
    case 'text/csv':
      return '.csv';
    default:
      return '';
  }
}

// Normalizacja ścieżek: jeśli src to pełny URL prowadzący do /uploads/..., zamień na ścieżkę względną
function normalizeSrc(src) {
  if (!src || typeof src !== 'string') return src;
  try {
    // Jeśli to pełny URL do /uploads/..., usuń origin
    const m = src.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/i);
    if (m) return m[1];
    return src;
  } catch {
    return src;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const orig = file.originalname || 'upload';
    const ext = path.extname(orig) || extFromMime(file.mimetype) || '';
    const base =
      path
        .basename(orig, path.extname(orig))
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .slice(0, 50) || 'file';
    const name = `${Date.now()}-${base}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

// Simple in-memory session blacklist for logout
const tokenBlacklist = new Set();

// Schemas
const PageSchema = z.object({
  id: z.string(),
  title: z.string(),
  src: z.string().url().or(z.string().startsWith('/')),
  kind: z.enum(['html', 'csv', 'xlsx', 'image', 'pdf']).optional(),
  password: z.string(),
});

const BookSchema = z.object({
  slug: z.string(),
  name: z.string(),
  pages: z.array(PageSchema),
});

const BooksSchema = z.array(BookSchema);

async function readBooks() {
  try {
    const buf = await fs.readFile(DATA_FILE, 'utf8');
    const json = JSON.parse(buf);
    return BooksSchema.parse(json);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function writeBooks(data) {
  const json = JSON.stringify(BooksSchema.parse(data), null, 2);
  await fs.writeFile(DATA_FILE, json, 'utf8');
}

function sign(user) {
  return jwt.sign({ sub: user }, JWT_SECRET, { expiresIn: '12h' });
}

function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  if (tokenBlacklist.has(token)) return res.status(401).json({ error: 'revoked' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload.sub;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Auth routes
app.post('/api/auth/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body ?? {};
  // For demo: allow plaintext check; you can set ADMIN_PASS to a bcrypt hash starting with $2a$
  const okUser = username === ADMIN_USER;
  const okPass = ADMIN_PASS?.startsWith('$2')
    ? await bcrypt.compare(password ?? '', ADMIN_PASS)
    : password === ADMIN_PASS;
  if (!okUser || !okPass) return res.status(401).json({ error: 'bad credentials' });
  return res.json({ token: sign(username) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (token) tokenBlacklist.add(token);
  res.json({ ok: true });
});

// Public endpoint for frontend
app.get('/api/books', async (req, res) => {
  const books = await readBooks();
  res.json(books);
});

// Admin CRUD (protected)
app.get('/api/admin/books', auth, async (req, res) => {
  res.json(await readBooks());
});

app.post('/api/admin/books', auth, async (req, res) => {
  try {
    const incoming = req.body || {};
    // znormalizuj src w stronach zanim przejdzie walidację
    if (Array.isArray(incoming.pages)) {
      incoming.pages = incoming.pages.map((p) => ({ ...p, src: normalizeSrc(p?.src) }));
    }
    const book = BookSchema.parse(incoming);
    const books = await readBooks();
    if (books.some((b) => b.slug === book.slug)) {
      return res.status(400).json({ error: 'slug exists' });
    }
    books.push(book);
    await writeBooks(books);
    res.status(201).json(book);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/books/:slug', auth, async (req, res) => {
  try {
    const slug = req.params.slug;
    const incoming = req.body || {};
    if (Array.isArray(incoming.pages)) {
      incoming.pages = incoming.pages.map((p) => ({ ...p, src: normalizeSrc(p?.src) }));
    }
    const book = BookSchema.parse(incoming);
    if (book.slug !== slug) return res.status(400).json({ error: 'slug mismatch' });
    const books = await readBooks();
    const idx = books.findIndex((b) => b.slug === slug);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    books[idx] = book;
    await writeBooks(books);
    res.json(book);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/books/:slug', auth, async (req, res) => {
  const slug = req.params.slug;
  const books = await readBooks();
  const next = books.filter((b) => b.slug !== slug);
  if (next.length === books.length) return res.status(404).json({ error: 'not found' });
  await writeBooks(next);
  res.json({ ok: true });
});

// Import pełnej listy książek (zastępuje istniejące)
app.post('/api/admin/import', auth, async (req, res) => {
  try {
    let payload = req.body;
    // pozwól na formę { books: [...] } albo bezpośrednio [...]
    const books = Array.isArray(payload) ? payload : payload?.books;
    if (!Array.isArray(books))
      return res.status(400).json({ error: 'expected array or {books:[]}' });
    // Znormalizuj wszystkie src podczas importu
    const normalized = (books || []).map((b) => ({
      ...b,
      pages: (b.pages || []).map((p) => ({ ...p, src: normalizeSrc(p?.src) })),
    }));
    await writeBooks(normalized);
    res.json({ ok: true, count: normalized.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Upload pliku (zwraca ścieżkę URL)
app.post('/api/admin/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  // Normalizujemy rozszerzenie: zachowujemy oryginalną nazwę jako hint (nie przenosimy pliku, multer nadaje nazwę losową)
  const url = `/uploads/${req.file.filename}`;
  res.json({
    url,
    originalName: req.file.originalname,
    mime: req.file.mimetype,
    size: req.file.size,
  });
});

// Mirror pliku z podanego URL do uploads (np. z frontendu 4200)
app.post('/api/admin/mirror', auth, async (req, res) => {
  try {
    let { url } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'missing url' });
    // Zbuduj pełny URL, jeśli ścieżka względna
    if (url.startsWith('/')) url = SOURCE_BASE.replace(/\/$/, '') + url;
    const r = await fetch(url);
    if (!r.ok) return res.status(400).json({ error: `fetch ${r.status}` });
    const ct = r.headers.get('content-type') || '';
    const u = new URL(url);
    const origName = path.basename(u.pathname);
    const ext = path.extname(origName) || extFromMime(ct) || '';
    const base =
      path
        .basename(origName, path.extname(origName))
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .slice(0, 50) || 'file';
    const name = `${Date.now()}-${base}${ext}`;
    const buf = Buffer.from(await r.arrayBuffer());
    const filePath = path.join(uploadsDir, name);
    await fs.writeFile(filePath, buf);
    return res.json({ url: `/uploads/${name}`, mime: ct, size: buf.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Dodaj/aktualizuj stronę w książce
app.post('/api/admin/books/:slug/pages', auth, async (req, res) => {
  try {
    const slug = req.params.slug;
    const PageUpsertSchema = PageSchema.pick({
      id: true,
      title: true,
      src: true,
      kind: true,
      password: true,
    });
    const incoming = req.body || {};
    incoming.src = normalizeSrc(incoming.src);
    const page = PageUpsertSchema.parse(incoming);
    const books = await readBooks();
    const idx = books.findIndex((b) => b.slug === slug);
    if (idx === -1) return res.status(404).json({ error: 'book not found' });
    const pages = books[idx].pages || [];
    const pidx = pages.findIndex((p) => p.id === page.id);
    if (pidx === -1) pages.push(page);
    else pages[pidx] = page;
    books[idx].pages = pages;
    await writeBooks(books);
    res.status(pidx === -1 ? 201 : 200).json(page);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/books/:slug/pages/:id', auth, async (req, res) => {
  const { slug, id } = req.params;
  const books = await readBooks();
  const idx = books.findIndex((b) => b.slug === slug);
  if (idx === -1) return res.status(404).json({ error: 'book not found' });
  const before = books[idx].pages?.length || 0;
  books[idx].pages = (books[idx].pages || []).filter((p) => p.id !== id);
  const after = books[idx].pages.length;
  if (before === after) return res.status(404).json({ error: 'page not found' });
  await writeBooks(books);
  res.json({ ok: true });
});

// Narzędziowo: znormalizuj src w całym katalogu (usuń origin, zostaw /uploads/...)
app.post('/api/admin/normalize-src', auth, async (req, res) => {
  const dryRun = !!req.body?.dryRun;
  const books = await readBooks();
  let changed = 0;
  for (const b of books) {
    for (const p of b.pages || []) {
      const before = p.src;
      const after = normalizeSrc(before);
      if (before !== after) {
        if (!dryRun) p.src = after;
        changed++;
      }
    }
  }
  if (!dryRun) await writeBooks(books);
  res.json({ ok: true, dryRun, changed });
});

// Migracja plików z public/ do uploads/ oraz aktualizacja src w books.json
// (usunięto) endpoint migracji plików

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] data file: ${DATA_FILE}`);
});

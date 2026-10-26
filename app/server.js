require('dotenv').config();
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const mysql = require('mysql2/promise');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'blog_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blog_cms_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

// ---------- Prometheus metrics ----------
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'blogcms_' });
const httpTotal = new client.Counter({
  name: 'blogcms_http_requests_total', help: 'Tong so HTTP request',
  labelNames: ['method', 'route', 'status_code'], registers: [register],
});
const httpDuration = new client.Histogram({
  name: 'blogcms_http_request_duration_seconds', help: 'Thoi gian xu ly request',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5], registers: [register],
});
const dbQueries = new client.Counter({
  name: 'blogcms_db_queries_total', help: 'Tong so truy van CSDL', registers: [register],
});
const activeRequests = new client.Gauge({
  name: 'blogcms_active_requests', help: 'So request dang xu ly', registers: [register],
});

async function q(sql, params = []) {
  dbQueries.inc();
  const [rows] = await pool.query(sql, params);
  return rows;
}

// ---------- Middleware ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan(':remote-addr [blog-app] ":method :url" :status :res[content-length] - :response-time ms'));

app.use((req, res, next) => {
  if (req.path === '/metrics') return next();
  activeRequests.inc();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpTotal.inc(labels);
    end(labels);
    activeRequests.dec();
  });
  next();
});

app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.studentId = 'DTC245200493';
  next();
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'muc';
}

// ---------- Monitoring endpoints ----------
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', app: 'up', database: 'up', uptime: process.uptime() });
  } catch (e) {
    res.status(503).json({ status: 'error', app: 'up', database: 'down' });
  }
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ---------- Home ----------
app.get('/', wrap(async (req, res) => {
  const posts = await q(`SELECT p.*, c.name AS category_name, u.full_name AS author_name
    FROM posts p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN users u ON p.author_id=u.id
    WHERE p.status='published' ORDER BY p.created_at DESC LIMIT 6`);
  const [stats] = await q(`SELECT (SELECT COUNT(*) FROM posts) posts,
    (SELECT COUNT(*) FROM categories) categories, (SELECT COUNT(*) FROM users) users`);
  res.render('index', { posts, stats });
}));

// ---------- Posts ----------
async function formData() {
  return { categories: await q('SELECT id,name FROM categories ORDER BY name'),
           users: await q('SELECT id,full_name FROM users ORDER BY full_name') };
}
app.get('/posts', wrap(async (req, res) => {
  const { category = '', keyword = '', view = 'grid' } = req.query;
  const where = []; const params = [];
  if (category) { where.push('p.category_id=?'); params.push(category); }
  if (keyword) { where.push('(p.title LIKE ? OR p.content LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  const posts = await q(`SELECT p.*, c.name AS category_name, u.full_name AS author_name
    FROM posts p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN users u ON p.author_id=u.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC`, params);
  res.render('posts/index', { posts, categories: await q('SELECT id,name FROM categories ORDER BY name'),
    category, keyword, view });
}));
app.get('/posts/new', wrap(async (req, res) => {
  res.render('posts/create', { post: {}, ...(await formData()) });
}));
app.post('/posts', wrap(async (req, res) => {
  const { title, content, category_id, author_id, status } = req.body;
  await q('INSERT INTO posts (title,slug,content,status,category_id,author_id) VALUES (?,?,?,?,?,?)',
    [title, slugify(title), content, status === 'draft' ? 'draft' : 'published', category_id || null, author_id || null]);
  res.redirect('/posts');
}));
app.get('/posts/:id', wrap(async (req, res, next) => {
  const [post] = await q(`SELECT p.*, c.name AS category_name, u.full_name AS author_name
    FROM posts p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN users u ON p.author_id=u.id WHERE p.id=?`, [req.params.id]);
  if (!post) return next();
  res.render('posts/show', { post });
}));
app.get('/posts/:id/edit', wrap(async (req, res, next) => {
  const [post] = await q('SELECT * FROM posts WHERE id=?', [req.params.id]);
  if (!post) return next();
  res.render('posts/edit', { post, ...(await formData()) });
}));
app.post('/posts/:id/update', wrap(async (req, res) => {
  const { title, content, category_id, author_id, status } = req.body;
  await q('UPDATE posts SET title=?,slug=?,content=?,status=?,category_id=?,author_id=? WHERE id=?',
    [title, slugify(title), content, status === 'draft' ? 'draft' : 'published', category_id || null, author_id || null, req.params.id]);
  res.redirect('/posts/' + req.params.id);
}));
app.post('/posts/:id/delete', wrap(async (req, res) => {
  await q('DELETE FROM posts WHERE id=?', [req.params.id]);
  res.redirect('/posts');
}));

// ---------- Categories ----------
app.get('/categories', wrap(async (req, res) => {
  const categories = await q(`SELECT c.*, COUNT(p.id) AS post_count FROM categories c
    LEFT JOIN posts p ON p.category_id=c.id GROUP BY c.id ORDER BY c.name`);
  res.render('categories/index', { categories });
}));
app.get('/categories/new', (req, res) => res.render('categories/create', { item: {} }));
app.post('/categories', wrap(async (req, res) => {
  const { name, description } = req.body;
  await q('INSERT INTO categories (name,slug,description) VALUES (?,?,?)', [name, slugify(name), description]);
  res.redirect('/categories');
}));
app.get('/categories/:id/edit', wrap(async (req, res, next) => {
  const [item] = await q('SELECT * FROM categories WHERE id=?', [req.params.id]);
  if (!item) return next();
  res.render('categories/edit', { item });
}));
app.post('/categories/:id/update', wrap(async (req, res) => {
  const { name, description } = req.body;
  await q('UPDATE categories SET name=?,slug=?,description=? WHERE id=?', [name, slugify(name), description, req.params.id]);
  res.redirect('/categories');
}));
app.post('/categories/:id/delete', wrap(async (req, res) => {
  await q('DELETE FROM categories WHERE id=?', [req.params.id]);
  res.redirect('/categories');
}));

// ---------- Users ----------
app.get('/users', wrap(async (req, res) => {
  const users = await q(`SELECT u.*, COUNT(p.id) AS post_count FROM users u
    LEFT JOIN posts p ON p.author_id=u.id GROUP BY u.id ORDER BY u.full_name`);
  res.render('users/index', { users });
}));
app.get('/users/new', (req, res) => res.render('users/create', { item: {} }));
app.post('/users', wrap(async (req, res) => {
  const { username, email, full_name, role } = req.body;
  await q('INSERT INTO users (username,email,full_name,role) VALUES (?,?,?,?)', [username, email, full_name, role]);
  res.redirect('/users');
}));
app.get('/users/:id/edit', wrap(async (req, res, next) => {
  const [item] = await q('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!item) return next();
  res.render('users/edit', { item });
}));
app.post('/users/:id/update', wrap(async (req, res) => {
  const { username, email, full_name, role } = req.body;
  await q('UPDATE users SET username=?,email=?,full_name=?,role=? WHERE id=?', [username, email, full_name, role, req.params.id]);
  res.redirect('/users');
}));
app.post('/users/:id/delete', wrap(async (req, res) => {
  await q('DELETE FROM users WHERE id=?', [req.params.id]);
  res.redirect('/users');
}));

// ---------- Errors ----------
app.use((req, res) => res.status(404).render('error', { code: 404, message: 'Không tìm thấy trang' }));
app.use((err, req, res, next) => {
  console.error('[blog-app] ERROR', err.message);
  const dup = err.code === 'ER_DUP_ENTRY';
  res.status(dup ? 400 : 500).render('error', { code: dup ? 400 : 500,
    message: dup ? 'Dữ liệu bị trùng (slug / username / email đã tồn tại)' : 'Lỗi máy chủ nội bộ' });
});

app.listen(PORT, () => console.log(`[blog-app] listening on port ${PORT}`));

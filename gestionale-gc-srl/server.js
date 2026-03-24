const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// ── Session tokens (in-memory, reset on restart) ──
const sessions = new Map(); // token -> { userId, role, createdAt }

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── JSON Database ──
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.error('Errore lettura DB:', e.message); }
  return null;
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getDB() {
  let db = loadDB();
  if (!db) {
    db = createDefaultDB();
    saveDB(db);
    console.log('Database inizializzato');
  }
  return db;
}

function createDefaultDB() {
  const colors = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#4f46e5','#c026d3','#059669'];
  // PIN di default: 1234 per tutti — CAMBIATELI al primo accesso!
  const workers = [
    { id:1, name:'Marco Bianchi', role:'operaio', spec:'Idraulica', color:colors[0], pin:'1234', active:true },
    { id:2, name:'Luca Verdi', role:'operaio', spec:'Piastrellista', color:colors[1], pin:'1234', active:true },
    { id:3, name:'Paolo Russo', role:'operaio', spec:'Muratura', color:colors[2], pin:'1234', active:true },
    { id:4, name:'Andrea Ferraro', role:'operaio', spec:'Idraulica', color:colors[3], pin:'1234', active:true },
    { id:5, name:'Giovanni Moretti', role:'operaio', spec:'Elettricista', color:colors[4], pin:'1234', active:true },
    { id:6, name:'Giuseppe', role:'ufficio', spec:'Direzione', color:colors[5], pin:'0000', active:true },
    { id:7, name:'Anna Colombo', role:'ufficio', spec:'Amministrazione', color:colors[6], pin:'0000', active:true },
    { id:8, name:'Sara Ricci', role:'ufficio', spec:'Segreteria', color:colors[7], pin:'0000', active:true },
    { id:9, name:'Marta Esposito', role:'ufficio', spec:'Contabilità', color:colors[8], pin:'0000', active:true },
  ];

  const clients = [
    { name:'Fam. Marchetti', addr:'Via Roma 15, Milano', phone:'02 1234567' },
    { name:'Sig. Colombo', addr:'Via Garibaldi 42, Monza', phone:'039 7654321' },
    { name:'Sig.ra Fontana', addr:'Corso Italia 8, Bergamo', phone:'035 9876543' },
    { name:'Fam. De Luca', addr:'Via Manzoni 23, Brescia', phone:'030 1122334' },
    { name:'Sig. Morandi', addr:'Via Dante 67, Varese', phone:'0332 5566778' },
    { name:'Fam. Pellegrini', addr:'Via Verdi 11, Como', phone:'031 2233445' },
    { name:'Sig.ra Galli', addr:'Piazza Duomo 3, Lodi', phone:'0371 8899001' },
    { name:'Fam. Rinaldi', addr:'Via Leopardi 55, Pavia', phone:'0382 3344556' },
  ];
  const types = ['Ristrutturazione completa','Sostituzione sanitari','Impianto idraulico','Piastrellatura','Assistenza','Sopralluogo'];
  const statuses = ['da_fare','in_corso','completato'];
  const materialsList = [
    'Piatto doccia 80x120, box doccia cristallo, miscelatore termostatico',
    'WC sospeso, bidet sospeso, cassetta incasso Geberit',
    'Tubazioni multistrato, raccordi, valvole arresto',
    'Piastrelle 60x60 gres porcellanato, colla, fugante',
    'Rubinetteria completa, piletta click-clack',
    'Mobile bagno 100cm, lavabo incasso, specchio LED',
  ];

  const jobs = [];
  const today = new Date();
  let id = 1;
  const operai = workers.filter(w => w.role === 'operaio');

  for (let d = -7; d <= 14; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    const ds = date.toISOString().slice(0, 10);
    const numJobs = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numJobs; j++) {
      const cl = clients[Math.floor(Math.random() * clients.length)];
      const wk = operai[Math.floor(Math.random() * operai.length)];
      let status;
      if (d < -1) status = 'completato';
      else if (d <= 0) status = statuses[Math.floor(Math.random() * 3)];
      else status = 'da_fare';
      jobs.push({
        id: id++, client: cl.name, phone: cl.phone, address: cl.addr,
        date: ds, time: `${String(7 + j * 2).padStart(2,'0')}:${j % 2 === 0 ? '00' : '30'}`,
        type: types[Math.floor(Math.random() * types.length)],
        worker_id: wk.id, status,
        materials: Math.random() > 0.3 ? materialsList[Math.floor(Math.random() * materialsList.length)] : '',
        notes: Math.random() > 0.6 ? 'Cliente disponibile solo al mattino' : '',
        created_at: new Date().toISOString(),
      });
    }
  }
  return { workers, jobs, nextWorkerId: 10, nextJobId: id };
}

// ── Middleware ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ──
function getSessionUser(req) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const db = getDB();
  return db.workers.find(w => w.id === session.userId) || null;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Accesso richiesto' });
  req.user = user;
  next();
}

function requireOffice(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'ufficio') {
    return res.status(403).json({ error: 'Accesso riservato all\'ufficio' });
  }
  req.user = user;
  next();
}

// ── API: Auth ──
app.get('/api/users', (req, res) => {
  // Public: returns names only (no PINs, no sensitive data) for login screen
  const db = getDB();
  res.json(db.workers.filter(w => w.active !== false).map(w => ({
    id: w.id, name: w.name, role: w.role, spec: w.spec, color: w.color
  })));
});

app.post('/api/login', (req, res) => {
  const { userId, pin } = req.body;
  const db = getDB();
  const user = db.workers.find(w => w.id === userId && w.active !== false);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  if (user.pin !== String(pin)) return res.status(401).json({ error: 'PIN errato' });

  const token = generateToken();
  sessions.set(token, { userId: user.id, role: user.role, createdAt: Date.now() });

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, spec: user.spec, color: user.color }
  });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.post('/api/change-pin', requireAuth, (req, res) => {
  const { oldPin, newPin } = req.body;
  if (!newPin || newPin.length < 4) return res.status(400).json({ error: 'PIN minimo 4 cifre' });
  const db = getDB();
  const user = db.workers.find(w => w.id === req.user.id);
  if (user.pin !== String(oldPin)) return res.status(401).json({ error: 'PIN attuale errato' });
  user.pin = String(newPin);
  saveDB(db);
  res.json({ ok: true });
});

// ── API: Workers ──
app.get('/api/workers', requireAuth, (req, res) => {
  const db = getDB();
  res.json(db.workers.filter(w => w.active !== false).map(w => ({
    id: w.id, name: w.name, role: w.role, spec: w.spec, color: w.color
  })));
});

app.post('/api/workers', requireOffice, (req, res) => {
  const db = getDB();
  const { name, role, spec, color, pin } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
  const colors = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#4f46e5','#c026d3','#059669','#d97706'];
  const worker = {
    id: db.nextWorkerId++,
    name, role: role || 'operaio', spec: spec || '',
    color: color || colors[Math.floor(Math.random() * colors.length)],
    pin: pin || '1234',
    active: true
  };
  db.workers.push(worker);
  saveDB(db);
  res.status(201).json({ id: worker.id, name: worker.name, role: worker.role, spec: worker.spec, color: worker.color });
});

app.put('/api/workers/:id', requireOffice, (req, res) => {
  const db = getDB();
  const w = db.workers.find(x => x.id === parseInt(req.params.id));
  if (!w) return res.status(404).json({ error: 'Non trovato' });
  if (req.body.name) w.name = req.body.name;
  if (req.body.role) w.role = req.body.role;
  if (req.body.spec !== undefined) w.spec = req.body.spec;
  if (req.body.color) w.color = req.body.color;
  if (req.body.pin) w.pin = req.body.pin;
  saveDB(db);
  res.json({ id: w.id, name: w.name, role: w.role, spec: w.spec, color: w.color });
});

app.delete('/api/workers/:id', requireOffice, (req, res) => {
  const db = getDB();
  const w = db.workers.find(x => x.id === parseInt(req.params.id));
  if (w) { w.active = false; saveDB(db); }
  res.json({ ok: true });
});

// ── API: Jobs ──
app.get('/api/jobs', requireAuth, (req, res) => {
  const db = getDB();
  const { from, to, worker_id, status } = req.query;
  const user = req.user;
  const forceWorkerId = (user.role === 'operaio') ? user.id : null;

  let jobs = db.jobs;
  if (from) jobs = jobs.filter(j => j.date >= from);
  if (to) jobs = jobs.filter(j => j.date <= to);
  if (forceWorkerId) {
    jobs = jobs.filter(j => j.worker_id === forceWorkerId);
  } else if (worker_id) {
    jobs = jobs.filter(j => j.worker_id === parseInt(worker_id));
  }
  if (status && status !== 'all') jobs = jobs.filter(j => j.status === status);

  jobs = jobs.map(j => {
    const w = db.workers.find(x => x.id === j.worker_id);
    return { ...j, worker_name: w ? w.name : 'Non assegnato', worker_color: w ? w.color : '#999' };
  });
  jobs.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  res.json(jobs);
});

app.get('/api/jobs/:id', requireAuth, (req, res) => {
  const db = getDB();
  const j = db.jobs.find(x => x.id === parseInt(req.params.id));
  if (!j) return res.status(404).json({ error: 'Non trovato' });
  if (req.user.role === 'operaio' && j.worker_id !== req.user.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }
  const w = db.workers.find(x => x.id === j.worker_id);
  res.json({ ...j, worker_name: w ? w.name : 'Non assegnato', worker_color: w ? w.color : '#999' });
});

app.post('/api/jobs', requireOffice, (req, res) => {
  const db = getDB();
  const { client, phone, address, date, time, type, worker_id, status, materials, notes } = req.body;
  if (!client || !address || !date) return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  const job = {
    id: db.nextJobId++,
    client, phone: phone || '', address, date,
    time: time || '08:00', type: type || 'Ristrutturazione completa',
    worker_id: parseInt(worker_id), status: status || 'da_fare',
    materials: materials || '', notes: notes || '',
    created_at: new Date().toISOString()
  };
  db.jobs.push(job);
  saveDB(db);
  const w = db.workers.find(x => x.id === job.worker_id);
  res.status(201).json({ ...job, worker_name: w ? w.name : '', worker_color: w ? w.color : '' });
});

app.put('/api/jobs/:id', requireOffice, (req, res) => {
  const db = getDB();
  const idx = db.jobs.findIndex(x => x.id === parseInt(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Non trovato' });
  const updated = { ...db.jobs[idx] };
  for (const [k, v] of Object.entries(req.body)) {
    if (v !== undefined && v !== null) updated[k] = k === 'worker_id' ? parseInt(v) : v;
  }
  updated.updated_at = new Date().toISOString();
  db.jobs[idx] = updated;
  saveDB(db);
  const w = db.workers.find(x => x.id === updated.worker_id);
  res.json({ ...updated, worker_name: w ? w.name : '', worker_color: w ? w.color : '' });
});

app.patch('/api/jobs/:id/status', requireAuth, (req, res) => {
  const db = getDB();
  const j = db.jobs.find(x => x.id === parseInt(req.params.id));
  if (!j) return res.status(404).json({ error: 'Non trovato' });
  // Operai can only update status of their own jobs
  if (req.user.role === 'operaio' && j.worker_id !== req.user.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }
  if (!['da_fare','in_corso','completato'].includes(req.body.status)) return res.status(400).json({ error: 'Stato non valido' });
  j.status = req.body.status;
  j.updated_at = new Date().toISOString();
  saveDB(db);
  const w = db.workers.find(x => x.id === j.worker_id);
  res.json({ ...j, worker_name: w ? w.name : '', worker_color: w ? w.color : '' });
});

// ── API: Search ──
app.get('/api/search', requireAuth, (req, res) => {
  const db = getDB();
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.json([]);

  const user = req.user;
  let jobs = db.jobs;
  // Operai can only search their own jobs
  if (user.role === 'operaio') jobs = jobs.filter(j => j.worker_id === user.id);

  const results = jobs.filter(j => {
    return j.client.toLowerCase().includes(q)
      || j.address.toLowerCase().includes(q)
      || j.phone.toLowerCase().includes(q)
      || j.date.includes(q)
      || j.type.toLowerCase().includes(q)
      || j.notes.toLowerCase().includes(q)
      || j.materials.toLowerCase().includes(q);
  });

  // Attach worker names, sort by date desc
  const enriched = results.map(j => {
    const w = db.workers.find(x => x.id === j.worker_id);
    return { ...j, worker_name: w ? w.name : 'Non assegnato', worker_color: w ? w.color : '#999' };
  });
  enriched.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  res.json(enriched.slice(0, 50));
});

app.delete('/api/jobs/:id', requireOffice, (req, res) => {
  const db = getDB();
  db.jobs = db.jobs.filter(x => x.id !== parseInt(req.params.id));
  saveDB(db);
  res.json({ ok: true });
});

// ── API: Stats ──
app.get('/api/stats', requireAuth, (req, res) => {
  const db = getDB();
  const d = req.query.date || new Date().toISOString().slice(0, 10);
  const dayJobs = db.jobs.filter(j => j.date === d);
  res.json({
    date: d, total: dayJobs.length,
    da_fare: dayJobs.filter(j => j.status === 'da_fare').length,
    in_corso: dayJobs.filter(j => j.status === 'in_corso').length,
    completato: dayJobs.filter(j => j.status === 'completato').length
  });
});

// ── API: Worker daily schedule ──
app.get('/api/my-schedule/:workerId', requireAuth, (req, res) => {
  const db = getDB();
  // Operai can only see their own schedule
  if (req.user.role === 'operaio' && req.user.id !== parseInt(req.params.workerId)) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const worker = db.workers.find(w => w.id === parseInt(req.params.workerId));
  const jobs = db.jobs
    .filter(j => j.worker_id === parseInt(req.params.workerId) && j.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  res.json({ worker: worker ? { id: worker.id, name: worker.name, spec: worker.spec, color: worker.color } : null, date, jobs });
});

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('========================================');
  console.log('  Gestionale G.C. srl  avviato!');
  console.log('========================================');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  PIN di default:');
  console.log('  Ufficio: 0000  |  Operai: 1234');
  console.log('  Cambiateli dopo il primo accesso!');
  console.log('========================================');
  console.log('');
});

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const sessions = new Map();
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// ── JSON Database ──
function loadDB() {
  try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) { console.error('DB error:', e.message); }
  return null;
}
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8'); }
function getDB() {
  let db = loadDB();
  if (!db) { db = createDefaultDB(); saveDB(db); console.log('Database inizializzato'); }
  return db;
}

function createDefaultDB() {
  const colors = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#4f46e5','#c026d3','#059669'];
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
  ];
  const types = ['Ristrutturazione completa','Ristrutturazione parziale','Vasca in doccia','Vasca in vasca','Assistenza','Sopralluogo','Altro'];
  const statuses = ['da_fare','in_corso','completato'];
  const materialsList = ['Piatto doccia 80x120, box doccia cristallo, miscelatore termostatico','WC sospeso, bidet sospeso, cassetta incasso Geberit','Piastrelle 60x60 gres porcellanato, colla, fugante'];
  const jobs = []; const today = new Date(); let id = 1;
  const operai = workers.filter(w => w.role === 'operaio');
  for (let d = -7; d <= 14; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    const ds = date.toISOString().slice(0,10);
    const numJobs = 1 + Math.floor(Math.random()*3);
    for (let j = 0; j < numJobs; j++) {
      const cl = clients[Math.floor(Math.random()*clients.length)];
      const wk = operai[Math.floor(Math.random()*operai.length)];
      let status = d < -1 ? 'completato' : d <= 0 ? statuses[Math.floor(Math.random()*3)] : 'da_fare';
      jobs.push({
        id: id++, client: cl.name, phone: cl.phone, address: cl.addr, date: ds,
        time: `${String(7+j*2).padStart(2,'0')}:${j%2===0?'00':'30'}`,
        type: types[Math.floor(Math.random()*types.length)], worker_id: wk.id, status,
        materials: Math.random()>0.3 ? materialsList[Math.floor(Math.random()*materialsList.length)] : '',
        notes: Math.random()>0.6 ? 'Cliente disponibile solo al mattino' : '',
        photos_office: [], photos_worker: [],
        created_at: new Date().toISOString(),
      });
    }
  }
  return { workers, jobs, nextWorkerId: 10, nextJobId: id };
}

// ── Middleware ──
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

function getSessionUser(req) {
  const token = req.headers['authorization']?.replace('Bearer ','');
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  return getDB().workers.find(w => w.id === s.userId) || null;
}
function requireAuth(req, res, next) { const u = getSessionUser(req); if (!u) return res.status(401).json({error:'Accesso richiesto'}); req.user = u; next(); }
function requireOffice(req, res, next) { const u = getSessionUser(req); if (!u||u.role!=='ufficio') return res.status(403).json({error:'Riservato ufficio'}); req.user = u; next(); }

// ── Auth ──
app.get('/api/users', (req, res) => {
  const db = getDB();
  res.json(db.workers.filter(w=>w.active!==false).map(w=>({id:w.id,name:w.name,role:w.role,spec:w.spec,color:w.color})));
});
app.post('/api/login', (req, res) => {
  const {userId,pin}=req.body; const db=getDB();
  const user=db.workers.find(w=>w.id===userId&&w.active!==false);
  if(!user) return res.status(404).json({error:'Utente non trovato'});
  if(user.pin!==String(pin)) return res.status(401).json({error:'PIN errato'});
  const token=generateToken(); sessions.set(token,{userId:user.id,role:user.role,createdAt:Date.now()});
  res.json({token,user:{id:user.id,name:user.name,role:user.role,spec:user.spec,color:user.color}});
});
app.post('/api/logout', (req,res)=>{ const t=req.headers['authorization']?.replace('Bearer ',''); if(t) sessions.delete(t); res.json({ok:true}); });
app.post('/api/change-pin', requireAuth, (req,res)=>{
  const {oldPin,newPin}=req.body;
  if(!newPin||newPin.length<4) return res.status(400).json({error:'PIN minimo 4 cifre'});
  const db=getDB(); const user=db.workers.find(w=>w.id===req.user.id);
  if(user.pin!==String(oldPin)) return res.status(401).json({error:'PIN attuale errato'});
  user.pin=String(newPin); saveDB(db); res.json({ok:true});
});

// ── Workers ──
app.get('/api/workers', requireAuth, (req,res)=>{
  res.json(getDB().workers.filter(w=>w.active!==false).map(w=>({id:w.id,name:w.name,role:w.role,spec:w.spec,color:w.color})));
});
app.post('/api/workers', requireOffice, (req,res)=>{
  const db=getDB(); const {name,role,spec,color,pin}=req.body;
  if(!name) return res.status(400).json({error:'Nome obbligatorio'});
  const colors=['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#4f46e5','#c026d3','#059669','#d97706'];
  const w={id:db.nextWorkerId++,name,role:role||'operaio',spec:spec||'',color:color||colors[Math.floor(Math.random()*colors.length)],pin:pin||'1234',active:true};
  db.workers.push(w); saveDB(db);
  res.status(201).json({id:w.id,name:w.name,role:w.role,spec:w.spec,color:w.color});
});
app.put('/api/workers/:id', requireOffice, (req,res)=>{
  const db=getDB(); const w=db.workers.find(x=>x.id===parseInt(req.params.id));
  if(!w) return res.status(404).json({error:'Non trovato'});
  if(req.body.name)w.name=req.body.name; if(req.body.role)w.role=req.body.role;
  if(req.body.spec!==undefined)w.spec=req.body.spec; if(req.body.color)w.color=req.body.color; if(req.body.pin)w.pin=req.body.pin;
  saveDB(db); res.json({id:w.id,name:w.name,role:w.role,spec:w.spec,color:w.color});
});
app.delete('/api/workers/:id', requireOffice, (req,res)=>{
  const db=getDB(); const w=db.workers.find(x=>x.id===parseInt(req.params.id));
  if(w){w.active=false; saveDB(db);} res.json({ok:true});
});

// ── Jobs ──
function enrichJob(j, db) {
  const w = db.workers.find(x=>x.id===j.worker_id);
  return {...j, worker_name:w?w.name:'Non assegnato', worker_color:w?w.color:'#999'};
}

app.get('/api/jobs', requireAuth, (req,res)=>{
  const db=getDB(); const {from,to,worker_id,status}=req.query;
  const user=req.user; const forceWId=(user.role==='operaio')?user.id:null;
  let jobs=db.jobs;
  if(from) jobs=jobs.filter(j=>j.date>=from);
  if(to) jobs=jobs.filter(j=>j.date<=to);
  if(forceWId) jobs=jobs.filter(j=>j.worker_id===forceWId);
  else if(worker_id) jobs=jobs.filter(j=>j.worker_id===parseInt(worker_id));
  if(status&&status!=='all') jobs=jobs.filter(j=>j.status===status);
  jobs=jobs.map(j=>enrichJob(j,db));
  jobs.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  res.json(jobs);
});

app.get('/api/jobs/:id', requireAuth, (req,res)=>{
  const db=getDB(); const j=db.jobs.find(x=>x.id===parseInt(req.params.id));
  if(!j) return res.status(404).json({error:'Non trovato'});
  if(req.user.role==='operaio'&&j.worker_id!==req.user.id) return res.status(403).json({error:'Non autorizzato'});
  res.json(enrichJob(j,db));
});

app.post('/api/jobs', requireOffice, (req,res)=>{
  const db=getDB(); const {client,phone,address,date,time,type,worker_id,status,materials,notes}=req.body;
  if(!client||!address||!date) return res.status(400).json({error:'Campi obbligatori mancanti'});
  const job={id:db.nextJobId++,client,phone:phone||'',address,date,time:time||'08:00',
    type:type||'Ristrutturazione completa',worker_id:parseInt(worker_id),status:status||'da_fare',
    materials:materials||'',notes:notes||'',photos_office:[],photos_worker:[],created_at:new Date().toISOString()};
  db.jobs.push(job); saveDB(db);
  res.status(201).json(enrichJob(job,db));
});

app.put('/api/jobs/:id', requireOffice, (req,res)=>{
  const db=getDB(); const idx=db.jobs.findIndex(x=>x.id===parseInt(req.params.id));
  if(idx<0) return res.status(404).json({error:'Non trovato'});
  const updated={...db.jobs[idx]};
  for(const [k,v] of Object.entries(req.body)){
    if(v!==undefined&&v!==null) updated[k]=k==='worker_id'?parseInt(v):v;
  }
  updated.updated_at=new Date().toISOString(); db.jobs[idx]=updated; saveDB(db);
  res.json(enrichJob(updated,db));
});

app.patch('/api/jobs/:id/status', requireAuth, (req,res)=>{
  const db=getDB(); const j=db.jobs.find(x=>x.id===parseInt(req.params.id));
  if(!j) return res.status(404).json({error:'Non trovato'});
  if(req.user.role==='operaio'&&j.worker_id!==req.user.id) return res.status(403).json({error:'Non autorizzato'});
  if(!['da_fare','in_corso','completato'].includes(req.body.status)) return res.status(400).json({error:'Stato non valido'});
  j.status=req.body.status; j.updated_at=new Date().toISOString(); saveDB(db);
  res.json(enrichJob(j,db));
});

app.delete('/api/jobs/:id', requireOffice, (req,res)=>{
  const db=getDB(); db.jobs=db.jobs.filter(x=>x.id!==parseInt(req.params.id)); saveDB(db); res.json({ok:true});
});

// ── Photos ──
app.post('/api/jobs/:id/photos', requireAuth, (req,res)=>{
  const db=getDB(); const j=db.jobs.find(x=>x.id===parseInt(req.params.id));
  if(!j) return res.status(404).json({error:'Non trovato'});
  // Operai can only add to their own jobs
  if(req.user.role==='operaio'&&j.worker_id!==req.user.id) return res.status(403).json({error:'Non autorizzato'});

  const {image, source} = req.body; // image = base64, source = 'office' or 'worker'
  if(!image) return res.status(400).json({error:'Immagine mancante'});

  const photoSource = req.user.role==='ufficio' ? 'office' : 'worker';
  const filename = `job_${j.id}_${photoSource}_${Date.now()}.jpg`;
  const filepath = path.join(UPLOADS_DIR, filename);

  // Strip base64 header if present
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

  const photoUrl = '/uploads/' + filename;
  if(!j.photos_office) j.photos_office=[];
  if(!j.photos_worker) j.photos_worker=[];

  if(photoSource==='office') j.photos_office.push({url:photoUrl, date:new Date().toISOString(), by:req.user.name});
  else j.photos_worker.push({url:photoUrl, date:new Date().toISOString(), by:req.user.name});

  saveDB(db);
  res.json({ok:true, url:photoUrl, source:photoSource});
});

// ── Search ──
app.get('/api/search', requireAuth, (req,res)=>{
  const db=getDB(); const q=(req.query.q||'').toLowerCase().trim();
  if(!q||q.length<2) return res.json([]);
  let jobs=db.jobs;
  if(req.user.role==='operaio') jobs=jobs.filter(j=>j.worker_id===req.user.id);
  const results=jobs.filter(j=>
    j.client.toLowerCase().includes(q)||j.address.toLowerCase().includes(q)||
    j.phone.toLowerCase().includes(q)||j.date.includes(q)||
    j.type.toLowerCase().includes(q)||j.notes.toLowerCase().includes(q)||
    j.materials.toLowerCase().includes(q)
  );
  const enriched=results.map(j=>enrichJob(j,db));
  enriched.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  res.json(enriched.slice(0,50));
});

// ── Stats ──
app.get('/api/stats', requireAuth, (req,res)=>{
  const db=getDB(); const d=req.query.date||new Date().toISOString().slice(0,10);
  const dj=db.jobs.filter(j=>j.date===d);
  res.json({date:d,total:dj.length,da_fare:dj.filter(j=>j.status==='da_fare').length,in_corso:dj.filter(j=>j.status==='in_corso').length,completato:dj.filter(j=>j.status==='completato').length});
});

// ── Weekly schedule (for mobile) ──
app.get('/api/my-week/:workerId', requireAuth, (req,res)=>{
  const db=getDB();
  if(req.user.role==='operaio'&&req.user.id!==parseInt(req.params.workerId)) return res.status(403).json({error:'Non autorizzato'});
  const startDate = req.query.start || new Date().toISOString().slice(0,10);
  const start = new Date(startDate);
  // Get Monday of the week
  const day = start.getDay(); const diff = start.getDate() - day + (day===0?-6:1);
  const monday = new Date(start); monday.setDate(diff);
  const days = [];
  for(let i=0;i<7;i++){
    const d=new Date(monday); d.setDate(monday.getDate()+i);
    const ds=d.toISOString().slice(0,10);
    const jobs=db.jobs.filter(j=>j.worker_id===parseInt(req.params.workerId)&&j.date===ds).sort((a,b)=>a.time.localeCompare(b.time));
    days.push({date:ds, dayOfWeek:i, jobs});
  }
  const worker=db.workers.find(w=>w.id===parseInt(req.params.workerId));
  res.json({worker:worker?{id:worker.id,name:worker.name,spec:worker.spec,color:worker.color}:null, weekStart:monday.toISOString().slice(0,10), days});
});

app.get('/api/my-schedule/:workerId', requireAuth, (req,res)=>{
  const db=getDB();
  if(req.user.role==='operaio'&&req.user.id!==parseInt(req.params.workerId)) return res.status(403).json({error:'Non autorizzato'});
  const date=req.query.date||new Date().toISOString().slice(0,10);
  const worker=db.workers.find(w=>w.id===parseInt(req.params.workerId));
  const jobs=db.jobs.filter(j=>j.worker_id===parseInt(req.params.workerId)&&j.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  res.json({worker:worker?{id:worker.id,name:worker.name,spec:worker.spec,color:worker.color}:null,date,jobs});
});

// ── Start ──
app.listen(PORT,'0.0.0.0',()=>{
  console.log('\n========================================');
  console.log('  Gestionale G.C. srl  avviato!');
  console.log('========================================');
  console.log('  http://localhost:'+PORT);
  console.log('  PIN default: Ufficio 0000 | Operai 1234');
  console.log('========================================\n');
});

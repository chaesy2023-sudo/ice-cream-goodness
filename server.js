const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Pool}=require('pg');
const PORT=process.env.PORT||3000,HOST=process.env.HOST||'0.0.0.0',USE_DB=!!process.env.DATABASE_URL;
const DATA=path.join(__dirname,'data','members.json'), PINFILE=path.join(__dirname,'data','admin.json');
if(!USE_DB){if(!fs.existsSync(path.dirname(DATA)))fs.mkdirSync(path.dirname(DATA),{recursive:true});
if(!fs.existsSync(DATA))fs.writeFileSync(DATA,JSON.stringify([{id:1,name:'สมาชิกตัวอย่าง 01',score:100},{id:2,name:'สมาชิกตัวอย่าง 02',score:75},{id:3,name:'สมาชิกตัวอย่าง 03',score:50}],null,2));
if(!fs.existsSync(PINFILE))fs.writeFileSync(PINFILE,JSON.stringify({password:'ICEADMIN2026'},null,2));}
const pool=USE_DB?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;
const sessions=new Map();
const read=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return[]}};
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2));
const json=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const body=req=>new Promise((ok,bad)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e6)req.destroy()});req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch(e){bad(e)}})});
const token=req=>{const m=(req.headers.cookie||'').match(/sid=([^;]+)/);return m?m[1]:null};
const admin=req=>{const t=token(req);return !!(t&&sessions.has(t)&&sessions.get(t)>Date.now())};
async function initDb(){if(!USE_DB)return;
await pool.query(`CREATE TABLE IF NOT EXISTS members(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
const c=await pool.query('SELECT COUNT(*)::int count FROM members');
if(c.rows[0].count===0){for(const m of read(DATA)){await pool.query('INSERT INTO members(id,name,score) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[Number(m.id),String(m.name),Number(m.score||0)])}}
const a=await pool.query("SELECT value FROM settings WHERE key='admin_password'");
if(!a.rowCount){let pw='ICEADMIN2026';try{pw=JSON.parse(fs.readFileSync(PINFILE,'utf8')).password||pw}catch{}await pool.query("INSERT INTO settings(key,value) VALUES('admin_password',$1)",[pw])}}
async function members(){if(USE_DB){const r=await pool.query('SELECT id,name,score FROM members ORDER BY score DESC,id ASC');return r.rows}return read(DATA).sort((a,b)=>b.score-a.score)}
async function password(){if(USE_DB){const r=await pool.query("SELECT value FROM settings WHERE key='admin_password'");return r.rows[0]?.value||'ICEADMIN2026'}return read(PINFILE).password||'ICEADMIN2026'}
async function setPassword(p){if(USE_DB)await pool.query("INSERT INTO settings(key,value) VALUES('admin_password',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[p]);else write(PINFILE,{password:p})}
function serve(req,res){const u=new URL(req.url,'http://x'),f=u.pathname==='/'?'index.html':u.pathname.slice(1),root=path.resolve(__dirname,'public'),file=path.resolve(root,f);
if(!file.startsWith(root+path.sep)&&file!==root)return res.writeHead(403).end();fs.stat(file,(e,s)=>{if(e||!s.isFile())return res.writeHead(404).end('Not found');
const ct={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':ct});fs.createReadStream(file).pipe(res)})}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');try{
if(req.method==='GET'&&u.pathname==='/api/members')return json(res,200,await members());
if(req.method==='POST'&&u.pathname==='/api/login'){const b=await body(req);if(b.password!==await password())return json(res,401,{error:'รหัสไม่ถูกต้อง'});const sid=crypto.randomBytes(24).toString('hex');sessions.set(sid,Date.now()+86400000);res.setHeader('Set-Cookie',`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);return json(res,200,{ok:true})}
if(req.method==='POST'&&u.pathname==='/api/logout'){const t=token(req);if(t)sessions.delete(t);res.setHeader('Set-Cookie','sid=; HttpOnly; Path=/; Max-Age=0');return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/api/me')return json(res,200,{admin:admin(req)});
if(req.method==='POST'&&u.pathname==='/api/members'){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});const b=await body(req),name=String(b.name||'').trim(),score=Number(b.score||0);if(!name)return json(res,400,{error:'กรุณาใส่ชื่อ'});
if(USE_DB)await pool.query('INSERT INTO members(name,score) VALUES($1,$2)',[name,score]);else{const m=read(DATA);m.push({id:Date.now(),name,score});write(DATA,m)}return json(res,200,{ok:true})}
if(req.method==='PATCH'&&u.pathname.startsWith('/api/members/')){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});const id=Number(u.pathname.split('/').pop()),b=await body(req);
if(USE_DB){const vals=[],sets=[];if(b.score!==undefined){vals.push(Number(b.score));sets.push(`score=$${vals.length}`)}if(b.name!==undefined){vals.push(String(b.name).trim());sets.push(`name=$${vals.length}`)}if(!sets.length)return json(res,200,{ok:true});vals.push(id);const r=await pool.query(`UPDATE members SET ${sets.join(',')} WHERE id=$${vals.length}`,vals);if(!r.rowCount)return json(res,404,{error:'ไม่พบสมาชิก'})}
else{const m=read(DATA),x=m.find(a=>a.id===id);if(!x)return json(res,404,{error:'ไม่พบสมาชิก'});if(b.score!==undefined)x.score=Number(b.score);if(b.name!==undefined)x.name=String(b.name).trim();write(DATA,m)}return json(res,200,{ok:true})}
if(req.method==='DELETE'&&u.pathname.startsWith('/api/members/')){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});const id=Number(u.pathname.split('/').pop());if(USE_DB)await pool.query('DELETE FROM members WHERE id=$1',[id]);else write(DATA,read(DATA).filter(x=>x.id!==id));return json(res,200,{ok:true})}
if(req.method==='POST'&&u.pathname==='/api/admin/password'){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});const p=String((await body(req)).password||'');if(p.length<6)return json(res,400,{error:'รหัสต้องมีอย่างน้อย 6 ตัว'});await setPassword(p);return json(res,200,{ok:true})}
serve(req,res)}catch(e){console.error(e);json(res,500,{error:'Server error'})}});
initDb().then(()=>server.listen(PORT,HOST,()=>console.log(`ICE CREAM GANG server: ${USE_DB?'PostgreSQL':'JSON'} on port ${PORT}`))).catch(e=>{console.error('Database initialization failed:',e);process.exit(1)});

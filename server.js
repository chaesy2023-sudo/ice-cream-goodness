const http=require('http');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const PORT=process.env.PORT||3000;const HOST=process.env.HOST||'0.0.0.0';
const DATA=path.join(__dirname,'data','members.json');
const PINFILE=path.join(__dirname,'data','admin.json');
if(!fs.existsSync(path.dirname(DATA)))fs.mkdirSync(path.dirname(DATA),{recursive:true});
if(!fs.existsSync(DATA))fs.writeFileSync(DATA,JSON.stringify([{id:1,name:'สมาชิกตัวอย่าง 01',score:100},{id:2,name:'สมาชิกตัวอย่าง 02',score:75},{id:3,name:'สมาชิกตัวอย่าง 03',score:50}],null,2));
if(!fs.existsSync(PINFILE))fs.writeFileSync(PINFILE,JSON.stringify({password:'ICEADMIN2026'},null,2));
const sessions=new Map();
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return []}}
function write(p,v){fs.writeFileSync(p,JSON.stringify(v,null,2))}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function body(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(d?JSON.parse(d):{})}catch(e){reject(e)}})})}
function token(req){let c=req.headers.cookie||'';let m=c.match(/sid=([^;]+)/);return m?m[1]:null}
function admin(req){let t=token(req);return t&&sessions.has(t)}
function serve(req,res){let u=new URL(req.url,'http://x');let f=u.pathname==='/'?'index.html':u.pathname.slice(1);let p=path.join(__dirname,'public',f);if(!p.startsWith(path.join(__dirname,'public')))return res.writeHead(403).end();fs.stat(p,(e,s)=>{if(e||!s.isFile())return res.writeHead(404).end('Not found');let ext=path.extname(p);let ct={'.html':'text/html; charset=utf-8','.png':'image/png','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':ct});fs.createReadStream(p).pipe(res)})}
const server=http.createServer(async(req,res)=>{let u=new URL(req.url,'http://x');try{
if(req.method==='GET'&&u.pathname==='/api/members'){let m=read(DATA).sort((a,b)=>b.score-a.score);return json(res,200,m)}
if(req.method==='POST'&&u.pathname==='/api/login'){let b=await body(req),a=read(PINFILE);if(b.password!==a.password)return json(res,401,{error:'รหัสไม่ถูกต้อง'});let sid=crypto.randomBytes(24).toString('hex');sessions.set(sid,Date.now()+86400000);res.setHeader('Set-Cookie',`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);return json(res,200,{ok:true})}
if(req.method==='POST'&&u.pathname==='/api/logout'){let t=token(req);if(t)sessions.delete(t);res.setHeader('Set-Cookie','sid=; HttpOnly; Path=/; Max-Age=0');return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname==='/api/me'){return json(res,200,{admin:admin(req)})}
if(req.method==='POST'&&u.pathname==='/api/members'){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});let b=await body(req);let n=String(b.name||'').trim();if(!n)return json(res,400,{error:'กรุณาใส่ชื่อ'});let m=read(DATA);m.push({id:Date.now(),name:n,score:Number(b.score||0)});write(DATA,m);return json(res,200,{ok:true})}
if(req.method==='PATCH'&&u.pathname.startsWith('/api/members/')){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});let id=Number(u.pathname.split('/').pop()),b=await body(req),m=read(DATA),x=m.find(a=>a.id===id);if(!x)return json(res,404,{error:'ไม่พบสมาชิก'});if(b.score!==undefined)x.score=Number(b.score);if(b.name!==undefined)x.name=String(b.name).trim();write(DATA,m);return json(res,200,{ok:true})}
if(req.method==='DELETE'&&u.pathname.startsWith('/api/members/')){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});let id=Number(u.pathname.split('/').pop());write(DATA,read(DATA).filter(x=>x.id!==id));return json(res,200,{ok:true})}
if(req.method==='POST'&&u.pathname==='/api/admin/password'){if(!admin(req))return json(res,401,{error:'ต้องเป็นแอดมิน'});let b=await body(req),p=String(b.password||'');if(p.length<6)return json(res,400,{error:'รหัสต้องมีอย่างน้อย 6 ตัว'});write(PINFILE,{password:p});return json(res,200,{ok:true})}
serve(req,res)
}catch(e){console.error(e);json(res,500,{error:'Server error'})}});
server.listen(PORT,HOST,()=>console.log(`ICE CREAM GANG server: http://localhost:${PORT}`));

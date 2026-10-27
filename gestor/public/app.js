/* Muttto · Gestor de Proyectos. Vanilla JS; habla con la API de server.js. */
(function(){
'use strict';

/* ---------- Catálogos ---------- */
const DEPTS=[
  ['proyectos','Proyectos'],['operaciones','Operaciones'],['marketing','Marketing'],
  ['logistica','Logística y almacén'],['finanzas','Finanzas y administración'],
  ['formacion','Formación'],['consultoria','Consultoría y equipo interno'],['comercial','Comercial']];
const LINES=[['','—'],['formacion','Formaciones'],['consultoria','Consultoría'],['producto','Venta de producto'],
  ['reformas','Reformas e interiorismo'],['mobiliario','Venta de mobiliario'],['vibro','Vibro Wellness Suite']];
const P_STATUS=[['planificado','Planificado','grey'],['en_curso','En curso','blue'],['en_pausa','En pausa','amber'],['completado','Completado','ok']];
const T_STATUS=[['pendiente','Pendiente','grey'],['en_curso','En curso','blue'],['revision','En revisión','amber'],['bloqueada','Bloqueada','red'],['hecha','Hecha','ok']];
const PRIO=[['baja','Baja','grey'],['media','Media','amber'],['alta','Alta','red']];
const lab=(list,v)=>(list.find(x=>x[0]===v)||[v,v||'—'])[1];
const tone=(list,v)=>(list.find(x=>x[0]===v)||[0,0,'grey'])[2];
const chip=(list,v)=>`<span class="chip ${tone(list,v)}">${esc(lab(list,v))}</span>`;

/* ---------- Utilidades ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+Math.random().toString(16).slice(2);
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const fmt=d=>d?new Date(d+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}):'—';
const isLate=t=>t.due_date&&t.due_date<today()&&t.status!=='hecha';
const initials=n=>(n||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2500)}

/* ---------- Almacén: API del servidor (Render) ---------- */
async function http(method,url,body){
  const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||'Error '+r.status);e.status=r.status;throw e}
  return j;
}
const api={
  async session(){try{return await http('GET','/api/me')}catch(e){if(e.status===401)return null;throw e}},
  signIn:(email,password)=>http('POST','/api/login',{email,password}),
  signUp:(email,password,name,department)=>http('POST','/api/signup',{email,password,name,department}),
  signOut:()=>http('POST','/api/logout'),
  load:()=>http('GET','/api/data'),
  save:(t,row)=>http('PUT','/api/'+t+'/'+row.id,row),
  remove:(t,id)=>http('DELETE','/api/'+t+'/'+id)
};

/* ---------- Estado ---------- */
let store=api,db={profiles:[],projects:[],tasks:[],comments:[]},me=null;
const ui={tab:'tareas',f:{dept:'',line:'',status:'',q:'',owner:''},team:'',navOpen:false};
const person=id=>db.profiles.find(p=>p.id===id);
const who=id=>{const p=person(id);return p?`<span class="who"><span class="avatar">${esc(initials(p.name))}</span>${esc(p.name)}</span>`:'<span class="muted small">Sin asignar</span>'};
const ptasks=pid=>db.tasks.filter(t=>t.project_id===pid);
const progress=pid=>{const t=ptasks(pid);return t.length?Math.round(100*t.filter(x=>x.status==='hecha').length/t.length):0};
const pOpts=(list,blank)=>(blank?[['',blank]]:[]).concat(list.map(x=>[x[0],x[1]]));
const people=()=>db.profiles.map(p=>[p.id,p.name]);
async function refresh(){db=await store.load()}
async function act(fn,msg){try{await fn();await refresh();render();if(msg)toast(msg)}catch(e){console.error(e);toast('Error: '+(e.message||e))}}

/* ---------- Rutas ---------- */
const route=()=>{const h=location.hash.replace(/^#\/?/,'').split('/');return{name:h[0]||'dashboard',id:h[1]}};
const go=h=>{location.hash=h;ui.navOpen=false};

/* ---------- Vistas ---------- */
function shell(inner,r){
  const nav=(h,ic,t)=>`<a class="nav ${r.name===h?'on':''}" data-go="#/${h}">${ic} ${t}</a>`;
  return `<div class="shell"><aside class="side ${ui.navOpen?'open':''}">
    <div class="brand"><img src="logo-muttto.png" alt="Muttto"><b>Gestor de<br>Proyectos</b></div>
    ${nav('dashboard','◧','Resumen')}${nav('projects','▤','Proyectos')}${nav('mytasks','✓','Mis tareas')}
    ${nav('departments','▦','Departamentos')}${nav('team','☺','Equipo')}
    <div class="sep">Departamentos</div>
    ${DEPTS.map(d=>`<a class="nav" data-go="#/departments/${d[0]}">${esc(d[1])}</a>`).join('')}
    <div class="me">${esc(me.name)}<br><span class="muted">${esc(me.email||'')}</span><br>
      <button data-act="logout">Cerrar sesión</button></div>
  </aside><main class="main"><button class="btn ghost menu-btn" data-act="menu" style="margin-bottom:12px">☰ Menú</button>${inner}</main></div>`;
}

function viewDashboard(){
  const open=db.tasks.filter(t=>t.status!=='hecha'),late=open.filter(isLate);
  const mine=open.filter(t=>t.assignee_id===me.id);
  const active=db.projects.filter(p=>p.status!=='completado');
  const soon=open.filter(t=>t.due_date&&t.due_date>=today()&&t.due_date<=addDays(7)).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const dep=DEPTS.map(([k,n])=>{const ps=db.projects.filter(p=>p.department===k&&p.status!=='completado');
    return{k,n,c:ps.length,late:db.tasks.filter(t=>isLate(t)&&ps.some(p=>p.id===t.project_id)).length}});
  return `<div class="head"><h1>Hola, ${esc(me.name.split(' ')[0])}</h1><button class="btn right" data-act="new-project">+ Nuevo proyecto</button></div>
  <div class="grid g4">
    <div class="card stat"><b>${active.length}</b><span>Proyectos activos</span></div>
    <div class="card stat"><b>${open.length}</b><span>Tareas abiertas</span></div>
    <div class="card stat ${late.length?'warn':''}"><b>${late.length}</b><span>Tareas atrasadas</span></div>
    <div class="card stat"><b>${mine.length}</b><span>Mis tareas abiertas</span></div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Próximos 7 días</h3>${soon.length?`<div class="tw"><table>${soon.slice(0,8).map(t=>taskRow(t,true)).join('')}</table></div>`:'<div class="empty">Nada con vencimiento esta semana.</div>'}</div>
    <div class="card"><h3>Por departamento</h3>${dep.map(d=>`<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer" data-go="#/departments/${d.k}"><span>${esc(d.n)}</span>
      <span class="right row"><span class="chip">${d.c} proyectos</span>${d.late?`<span class="chip red">${d.late} atrasadas</span>`:''}</span></div>`).join('')}</div>
  </div>
  ${late.length?`<div class="card" style="margin-top:16px"><h3>Atrasadas</h3><div class="tw"><table>${late.slice(0,10).map(t=>taskRow(t,true)).join('')}</table></div></div>`:''}`;
}

function taskRow(t,showProject){
  const p=db.projects.find(x=>x.id===t.project_id);
  return `<tr class="click" data-act="edit-task" data-id="${t.id}">
    <td class="${t.status==='hecha'?'done-t':''}">${esc(t.title)}${showProject&&p?`<br><span class="muted small">${esc(p.name)}</span>`:''}</td>
    <td>${who(t.assignee_id)}</td><td>${chip(T_STATUS,t.status)}</td><td>${chip(PRIO,t.priority)}</td>
    <td class="${isLate(t)?'late':''}">${fmt(t.due_date)}</td></tr>`;
}

function projectCard(p){
  const pr=progress(p.id),late=ptasks(p.id).filter(isLate).length;
  return `<div class="card pcard" data-go="#/project/${p.id}">
    <div class="row"><span class="chip">${esc(lab(DEPTS,p.department))}</span>${p.line?`<span class="chip grey">${esc(lab(LINES,p.line))}</span>`:''}<span class="right">${chip(P_STATUS,p.status)}</span></div>
    <h3 style="margin-top:10px">${esc(p.name)}</h3>
    <div class="muted small" style="min-height:32px">${esc((p.description||'').slice(0,110))}</div>
    <div class="bar" style="margin:12px 0 6px"><i style="width:${pr}%"></i></div>
    <div class="row small"><span>${pr}% · ${ptasks(p.id).length} tareas</span>${late?`<span class="chip red">${late} atrasadas</span>`:''}<span class="right muted">Entrega ${fmt(p.due_date)}</span></div>
    <div style="margin-top:8px">${who(p.owner_id)}</div></div>`;
}

function viewProjects(dept){
  if(dept!==undefined)ui.f.dept=dept;
  const f=ui.f,q=f.q.toLowerCase();
  const list=db.projects.filter(p=>(!f.dept||p.department===f.dept)&&(!f.line||p.line===f.line)&&(!f.status||p.status===f.status)&&(!f.owner||p.owner_id===f.owner)&&(!q||p.name.toLowerCase().includes(q)));
  const sel=(k,opts)=>`<select data-filter="${k}">${opts.map(o=>`<option value="${esc(o[0])}" ${f[k]===o[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
  return `<div class="head"><h1>${f.dept?esc(lab(DEPTS,f.dept)):'Proyectos'}</h1><button class="btn right" data-act="new-project">+ Nuevo proyecto</button></div>
  <div class="filters"><input data-filter="q" placeholder="Buscar…" value="${esc(f.q)}">
    ${sel('dept',pOpts(DEPTS,'Todos los departamentos'))}${sel('line',[['','Todas las líneas']].concat(LINES.slice(1)))}
    ${sel('status',pOpts(P_STATUS.map(s=>[s[0],s[1]]),'Todos los estados'))}${sel('owner',pOpts(people(),'Todos los responsables'))}</div>
  ${list.length?`<div class="grid g3">${list.map(projectCard).join('')}</div>`:'<div class="card empty">No hay proyectos con estos filtros.</div>'}`;
}

function viewProject(id){
  const p=db.projects.find(x=>x.id===id);
  if(!p)return '<div class="card empty">Proyecto no encontrado.</div>';
  const ts=ptasks(id).sort((a,b)=>(a.due_date||'9').localeCompare(b.due_date||'9'));
  let body;
  if(ui.tab==='tareas')body=ts.length?`<div class="tw"><table><tr><th>Tarea</th><th>Responsable</th><th>Estado</th><th>Prioridad</th><th>Vence</th></tr>${ts.map(t=>taskRow(t)).join('')}</table></div>`:'<div class="card empty">Aún no hay tareas. Crea la primera.</div>';
  else if(ui.tab==='tablero')body=`<div class="board">${T_STATUS.map(s=>`<div class="col" data-drop="${s[0]}"><h4>${s[1]}<span>${ts.filter(t=>t.status===s[0]).length}</span></h4>
    ${ts.filter(t=>t.status===s[0]).map(t=>`<div class="tcard" draggable="true" data-drag="${t.id}" data-act="edit-task" data-id="${t.id}"><b>${esc(t.title)}</b>
    <div class="row">${chip(PRIO,t.priority)}<span class="${isLate(t)?'late':'muted'} small right">${fmt(t.due_date)}</span></div>${who(t.assignee_id)}</div>`).join('')}</div>`).join('')}</div>`;
  else body=timeline(p,ts);
  return `<div class="head"><button class="btn ghost sm" data-go="#/projects">← Proyectos</button></div>
  <div class="card"><div class="row"><span class="chip">${esc(lab(DEPTS,p.department))}</span>${p.line?`<span class="chip grey">${esc(lab(LINES,p.line))}</span>`:''}${chip(P_STATUS,p.status)}${chip(PRIO,p.priority)}
    <span class="right row"><button class="btn ghost sm" data-act="edit-project" data-id="${p.id}">Editar</button><button class="btn ghost sm" data-act="del-project" data-id="${p.id}">Eliminar</button></span></div>
    <h1 style="margin:10px 0 4px">${esc(p.name)}</h1><p class="muted">${esc(p.description)}</p>
    <div class="row small" style="margin:10px 0">Responsable: ${who(p.owner_id)} <span>· ${fmt(p.start_date)} → ${fmt(p.due_date)}</span></div>
    <div class="bar"><i style="width:${progress(id)}%"></i></div><div class="small muted" style="margin-top:4px">${progress(id)}% completado</div></div>
  <div class="row" style="margin:18px 0 0"><div class="tabs" style="flex:1">${[['tareas','Lista'],['tablero','Tablero'],['cronograma','Cronograma']].map(t=>`<button class="${ui.tab===t[0]?'on':''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>
    <button class="btn" data-act="new-task" data-id="${id}" style="margin-bottom:14px">+ Tarea</button></div>${body}`;
}

function timeline(p,ts){
  const dated=ts.filter(t=>t.start_date||t.due_date);
  if(!dated.length)return '<div class="card empty">Añade fechas de inicio y vencimiento a las tareas para ver el cronograma.</div>';
  const all=dated.flatMap(t=>[t.start_date||t.due_date,t.due_date||t.start_date]).concat([today()]);
  const min=all.reduce((a,b)=>a<b?a:b),max=all.reduce((a,b)=>a>b?a:b);
  const D=d=>new Date(d+'T00:00:00').getTime(),span=Math.max(D(max)-D(min),864e5);
  const pos=d=>100*(D(d)-D(min))/span;
  return `<div class="tl"><div class="small muted" style="margin-bottom:6px">${fmt(min)} → ${fmt(max)} · línea roja = hoy</div>
  ${dated.map(t=>{const s=t.start_date||t.due_date,e=t.due_date||t.start_date;
    return `<div class="tl-row"><span class="small">${esc(t.title)}</span><div class="tl-track"><div class="tl-today" style="left:${pos(today())}%"></div>
    <div class="tl-bar ${t.status==='hecha'?'ok':isLate(t)?'red':''}" data-act="edit-task" data-id="${t.id}" style="left:${pos(s)}%;width:${Math.max(pos(e)-pos(s),1.5)}%;cursor:pointer" title="${esc(t.title)}"></div></div></div>`}).join('')}</div>`;
}

function viewMyTasks(){
  const mine=db.tasks.filter(t=>t.assignee_id===me.id).sort((a,b)=>(a.status==='hecha')-(b.status==='hecha')||(a.due_date||'9').localeCompare(b.due_date||'9'));
  return `<div class="head"><h1>Mis tareas</h1></div>${mine.length?`<div class="tw"><table><tr><th>Tarea</th><th>Responsable</th><th>Estado</th><th>Prioridad</th><th>Vence</th></tr>${mine.map(t=>taskRow(t,true)).join('')}</table></div>`:'<div class="card empty">No tienes tareas asignadas.</div>'}`;
}

function viewDepartments(){
  return `<div class="head"><h1>Departamentos</h1></div><div class="grid g3">${DEPTS.map(([k,n])=>{
    const ps=db.projects.filter(p=>p.department===k),open=ps.filter(p=>p.status!=='completado');
    const members=db.profiles.filter(p=>p.department===k);
    return `<div class="card pcard" data-go="#/departments/${k}"><h3>${esc(n)}</h3><div class="row"><span class="chip">${open.length} activos</span><span class="chip grey">${ps.length} en total</span></div>
      <div class="small muted" style="margin-top:10px">${members.length?members.map(m=>esc(m.name)).join(', '):'Sin personas asignadas'}</div></div>`}).join('')}</div>`;
}

function viewTeam(){
  return `<div class="head"><h1>Equipo</h1></div><div class="tw"><table><tr><th>Persona</th><th>Departamento</th><th>Proyectos</th><th>Tareas abiertas</th><th>Atrasadas</th></tr>
  ${db.profiles.map(p=>{const open=db.tasks.filter(t=>t.assignee_id===p.id&&t.status!=='hecha');
    return `<tr><td>${who(p.id)}<div class="muted small">${esc(p.email||'')}</div></td><td>${esc(lab(DEPTS,p.department))}</td><td>${db.projects.filter(x=>x.owner_id===p.id).length}</td><td>${open.length}</td><td class="${open.some(isLate)?'late':''}">${open.filter(isLate).length}</td></tr>`}).join('')}</table></div>`;
}

/* ---------- Formularios ---------- */
function field(f,v){
  const val=v[f.n]==null?'':v[f.n];let c;
  if(f.t==='select')c=`<select name="${f.n}">${f.o.map(o=>`<option value="${esc(o[0])}" ${String(val)===String(o[0])?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
  else if(f.t==='area')c=`<textarea name="${f.n}">${esc(val)}</textarea>`;
  else c=`<input name="${f.n}" type="${f.t||'text'}" value="${esc(val)}" ${f.r?'required':''}>`;
  return `<div class="field"><label>${f.l}</label>${c}</div>`;
}
function openForm(title,fields,values,onSave,extra){
  const m=$('#modal');
  const rows=[];for(let i=0;i<fields.length;i++){const f=fields[i];if(f.half&&fields[i+1]&&fields[i+1].half){rows.push(`<div class="two">${field(f,values)}${field(fields[i+1],values)}</div>`);i++}else rows.push(field(f,values))}
  m.innerHTML=`<form class="modal"><h2>${esc(title)}</h2>${rows.join('')}${extra||''}<div class="actions"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form>`;
  m.hidden=false;
  m.querySelector('form').onsubmit=e=>{e.preventDefault();const o={};new FormData(e.target).forEach((v,k)=>o[k]=v===''&&/date|_id$/.test(k)?null:v);m.hidden=true;onSave(o)};
}
const closeModal=()=>{$('#modal').hidden=true};

function projectForm(p){
  const edit=!!p;p=p||{department:'proyectos',status:'planificado',priority:'media',owner_id:me.id,start_date:today()};
  openForm(edit?'Editar proyecto':'Nuevo proyecto',[
    {n:'name',l:'Nombre',r:1},{n:'description',l:'Descripción',t:'area'},
    {n:'department',l:'Departamento',t:'select',o:DEPTS,half:1},{n:'line',l:'Línea de negocio',t:'select',o:LINES,half:1},
    {n:'owner_id',l:'Responsable',t:'select',o:pOpts(people(),'Sin asignar'),half:1},{n:'status',l:'Estado',t:'select',o:P_STATUS.map(s=>[s[0],s[1]]),half:1},
    {n:'priority',l:'Prioridad',t:'select',o:PRIO.map(s=>[s[0],s[1]]),half:1},{n:'start_date',l:'Inicio',t:'date',half:1},{n:'due_date',l:'Entrega',t:'date'}],p,
    o=>act(async()=>{const row={...p,...o,id:p.id||uid()};await store.save('projects',row);if(!edit)go('#/project/'+row.id)},'Proyecto guardado'));
}

function taskForm(t,projectId){
  const edit=!!t;t=t||{project_id:projectId,status:'pendiente',priority:'media',assignee_id:me.id,start_date:today()};
  const cm=edit?db.comments.filter(c=>c.task_id===t.id).sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')):[];
  const extra=edit?`<div class="field"><label>Comentarios</label>${cm.map(c=>`<div class="comment"><b>${esc((person(c.author_id)||{}).name||'')}</b> · <span class="muted">${esc((c.created_at||'').slice(0,10))}</span><br>${esc(c.body)}</div>`).join('')}
    <div class="row"><input id="newc" placeholder="Escribe un comentario…" style="flex:1;border:1px solid var(--line);border-radius:9px;padding:8px"><button type="button" class="btn sm" data-act="add-comment" data-id="${t.id}">Enviar</button></div></div>`:'';
  openForm(edit?'Editar tarea':'Nueva tarea',[
    {n:'title',l:'Tarea',r:1},{n:'notes',l:'Notas',t:'area'},
    {n:'assignee_id',l:'Responsable',t:'select',o:pOpts(people(),'Sin asignar'),half:1},{n:'status',l:'Estado',t:'select',o:T_STATUS.map(s=>[s[0],s[1]]),half:1},
    {n:'priority',l:'Prioridad',t:'select',o:PRIO.map(s=>[s[0],s[1]]),half:1},{n:'start_date',l:'Inicio',t:'date',half:1},{n:'due_date',l:'Vence',t:'date'}],t,
    o=>act(()=>store.save('tasks',{...t,...o,id:t.id||uid()}),'Tarea guardada'),
    extra+(edit?`<div style="margin-top:6px"><button type="button" class="btn danger sm" data-act="del-task" data-id="${t.id}">Eliminar tarea</button></div>`:''));
}

/* ---------- Login ---------- */
function loginView(signup){
  return `<div class="login"><form class="box" id="lf"><img src="logo-muttto.png" alt="Muttto"><h1>Gestor de Proyectos</h1>
    <p class="muted small" style="text-align:center;margin-bottom:16px">Muttto · The Beauty Lab</p>
    ${signup?'<div class="field"><label>Nombre</label><input name="name" required></div>':''}
    <div class="field"><label>Correo</label><input name="email" type="email" required autocomplete="username"></div>
    <div class="field"><label>Contraseña</label><input name="pw" type="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}"></div>
    ${signup?`<div class="field"><label>Departamento</label><select name="department">${DEPTS.map(d=>`<option value="${d[0]}">${esc(d[1])}</option>`).join('')}</select></div>`:''}
    <div class="err" id="lerr"></div><button class="btn" style="width:100%">${signup?'Crear cuenta':'Entrar'}</button>
    <div class="sw"><button type="button" data-act="${signup?'to-login':'to-signup'}">${signup?'Ya tengo cuenta':'Crear usuario nuevo'}</button></div>
  </form></div>`;
}

/* ---------- Render ---------- */
function render(){
  const app=$('#app');
  if(!me){app.innerHTML=loginView(ui.signup);$('#lf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{me=ui.signup?await store.signUp(d.email,d.pw,d.name,d.department):await store.signIn(d.email,d.pw);await refresh();render()}catch(x){$('#lerr').textContent=x.message}};return}
  const r=route();let v;
  if(r.name==='project')v=viewProject(r.id);
  else if(r.name==='projects')v=viewProjects();
  else if(r.name==='mytasks')v=viewMyTasks();
  else if(r.name==='team')v=viewTeam();
  else if(r.name==='departments')v=r.id?viewProjects(r.id):viewDepartments();
  else v=viewDashboard();
  const keep=document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.filter;
  app.innerHTML=shell(v,r);
  if(keep){const el=app.querySelector(`[data-filter="${keep}"]`);if(el){el.focus();if(el.setSelectionRange&&el.type==='text'||el.tagName==='INPUT'){const l=el.value.length;try{el.setSelectionRange(l,l)}catch(_){}}}}
  bindDnD();
}

function bindDnD(){
  document.querySelectorAll('[data-drag]').forEach(el=>el.ondragstart=e=>e.dataTransfer.setData('text/plain',el.dataset.drag));
  document.querySelectorAll('[data-drop]').forEach(c=>{
    c.ondragover=e=>{e.preventDefault();c.classList.add('over')};c.ondragleave=()=>c.classList.remove('over');
    c.ondrop=e=>{e.preventDefault();c.classList.remove('over');const t=db.tasks.find(x=>x.id===e.dataTransfer.getData('text/plain'));
      if(t&&t.status!==c.dataset.drop)act(()=>store.save('tasks',{...t,status:c.dataset.drop}))}});
}

/* ---------- Eventos ---------- */
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');if(g&&!e.target.closest('[data-act]')){go(g.dataset.go);return}
  const tab=e.target.closest('[data-tab]');if(tab){ui.tab=tab.dataset.tab;render();return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const id=a.dataset.id;
  switch(a.dataset.act){
    case'menu':ui.navOpen=!ui.navOpen;render();break;
    case'close':closeModal();break;
    case'logout':store.signOut().then(()=>{me=null;render()});break;
    case'to-signup':ui.signup=true;render();break;
    case'to-login':ui.signup=false;render();break;
    case'new-project':projectForm();break;
    case'edit-project':projectForm(db.projects.find(p=>p.id===id));break;
    case'del-project':if(confirm('¿Eliminar el proyecto y todas sus tareas?'))act(async()=>{await store.remove('projects',id);go('#/projects')},'Proyecto eliminado');break;
    case'new-task':taskForm(null,id);break;
    case'edit-task':taskForm(db.tasks.find(t=>t.id===id));break;
    case'del-task':if(confirm('¿Eliminar esta tarea?')){closeModal();act(()=>store.remove('tasks',id),'Tarea eliminada')}break;
    case'add-comment':{const i=$('#newc');if(!i.value.trim())break;const body=i.value.trim();closeModal();
      act(()=>store.save('comments',{id:uid(),task_id:id,author_id:me.id,body,created_at:new Date().toISOString()})).then(()=>taskForm(db.tasks.find(t=>t.id===id)));break}
  }
});
document.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.filter;if(k){ui.f[k]=e.target.value;render()}});
let prevName='';
window.addEventListener('hashchange',()=>{ui.navOpen=false;const n=route().name;if(n==='projects'&&prevName!=='projects')ui.f.dept='';prevName=n;if(me)render()});

/* ---------- Arranque ---------- */
(async function boot(){
  try{
    me=await store.session();if(me)await refresh();
    render();
    setInterval(()=>{if(me&&$('#modal').hidden&&!document.activeElement.matches('input,textarea,select'))refresh().then(render).catch(()=>{})},30000);
  }catch(e){$('#app').innerHTML=`<div class="login"><div class="box"><h1>No se pudo iniciar</h1><p class="err">${esc(e.message)}</p></div></div>`}
})();
})();

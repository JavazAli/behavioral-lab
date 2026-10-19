const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const D=require('../assets/data.js'),C=require('../assets/core.js');
const source=fs.readFileSync('assets/app.js','utf8'),studyId='test-study',key='behavioral-lab:'+studyId+':live';
const copy=value=>JSON.parse(JSON.stringify(value));
function record(){return {id:crypto.randomUUID(),studyId,version:D.version,participant:{name:'دانشجوی آزمایشی',studentId:'405123456',code:'OPEN-'+crypto.randomUUID().toUpperCase(),read:'no'},startedAt:'2026-10-19T10:00:00.000Z',order:D.questions.map(q=>q.id),answers:Object.fromEntries(D.questions.map(q=>[q.id,q.type==='choice'?q.options[0].value:q.min])),timings:{gain:1500}};}
function draft(){return {record:record(),index:3,flowVersion:2,confirmed:false,mode:'live'};}
function acknowledged(){const s=draft();s.record.completedAt='2026-10-19T10:10:00.000Z';s.confirmed=true;s.receipt={id:s.record.id,receivedAt:'2026-10-19T10:10:01.000Z'};s.aggregate=C.summarize([s.record]);return s;}
function ack(payload,aggregate=C.summarize([payload])){return {ok:true,id:payload.id,receivedAt:'2026-10-19T10:10:01.000Z',aggregate};}
function failure(message,retryable){const e=new Error(message);if(retryable!==undefined)e.retryable=retryable;return e;}
// A deterministic DOM/event harness runs the real app.js and core.js, without
// network calls or production writes. Route changes, storage and transport are controlled.
function app({hash='#/',stored=null,raw,handle=(_action,payload)=>ack(payload),blockedStorage=false}={}){
  const memory=new Map(),events=new Map(),nodes=new Map(),lists=new Map(),calls=[],renders=[],replacements=[],downloads=[],blobs=[];
  const initial=raw===undefined?(stored?JSON.stringify(stored):null):raw;if(initial!==null)memory.set(key,initial);
  memory.set('behavioral-lab:'+studyId+':browser-token',stored?.record?.participant?.code||'OPEN-00000000-0000-4000-8000-000000000000');
  let currentHash=hash,hashEvents=0,prints=0,timerId=0;const timers=new Set();
  class Element {
    constructor(id=''){this.id=id;this.listeners={};this.dataset={};this.value='';this.disabled=false;this.isConnected=true;this.style={};this.firstElementChild={style:{}};this.textContent='';this.classList={add(){},remove(){},toggle(){}};}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    fire(type,event={}){if(type==='click'&&this.disabled)return;return Promise.all((this.listeners[type]||[]).map(fn=>fn({preventDefault(){},currentTarget:this,...event})));}
    focus(){}setAttribute(){}scrollIntoView(){}querySelector(){return new Element();}
    insertAdjacentHTML(_where,html){this._html=html+(this._html||'');nodes.set('storage-warning',new Element('storage-warning'));}
    click(){downloads.push({download:this.download,href:this.href});return this.fire('click');}
    set innerHTML(html){this._html=html;if(this.id!=='main')return;renders.push(html);for(const [id,node]of nodes)if(!['main','toast','skip'].includes(id)){node.isConnected=false;nodes.delete(id);}lists.clear();for(const match of html.matchAll(/<(?:[a-z][\w-]*)\b([^>]*)>/gi)){const attrs=match[1],id=attrs.match(/\bid="([^"]+)"/)?.[1],node=new Element(id);node.disabled=/\bdisabled\b/.test(attrs);node.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';for(const m of attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)){node.dataset[m[1]]=m[2];const selector='[data-'+m[1]+']';if(!lists.has(selector))lists.set(selector,[]);lists.get(selector).push(node);}if(id)nodes.set(id,node);}}
    get innerHTML(){return this._html||'';}
  }
  for(const id of ['main','toast','skip'])nodes.set(id,new Element(id));
  const emit=(name,event)=>Promise.all((events.get(name)||[]).map(fn=>fn(event)));
  const location={get hash(){return currentHash;},set hash(value){const next=value.startsWith('#')?value:'#'+value;if(next===currentHash)return;currentHash=next;Promise.resolve().then(()=>{if(++hashEvents>100)throw new Error('Redirect loop');return emit('hashchange',{});});},reload(){}};
  const history={replaceState(_state,_title,url){replacements.push(url);currentHash=url;}};
  const window={LabData:D,LabCore:C,LAB_CONFIG:{studyId,endpoint:'https://script.google.com/macros/s/test/exec',refreshSeconds:60},LabTransport:function(){this.call=async(action,payload)=>{calls.push({action,payload:copy(payload)});return handle(action,copy(payload));};},addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},scrollTo(){},print(){prints++;}};
  const URLStub={createObjectURL(blob){blobs.push(blob);return 'blob:test';},revokeObjectURL(){}};
  vm.runInNewContext(source,{window,document:{body:{dataset:{}},getElementById:id=>nodes.get(id)||null,querySelectorAll:selector=>lists.get(selector)||[],querySelector:selector=>selector==='.skip'?nodes.get('skip'):new Element(),createElement:()=>new Element()},location,history,localStorage:{getItem(k){if(blockedStorage)throw Error('blocked');return memory.get(k)??null;},setItem(k,v){if(blockedStorage)throw Error('blocked');memory.set(k,v);}},FormData:class{constructor(form){this.fields=form.fields;}get(name){return this.fields[name]??null;}},crypto:crypto.webcrypto,Intl,Date,Number,Set,Object,Math,JSON,Blob,URL:URLStub,setTimeout(fn){const id=++timerId;timers.add(id);Promise.resolve().then(()=>{if(timers.delete(id))fn();});return id;},clearTimeout:id=>timers.delete(id)},{filename:'assets/app.js'});
  return {calls,renders,replacements,memory,downloads,blobs,location,emit,get html(){return nodes.get('main').innerHTML;},get state(){return JSON.parse(memory.get(key)||'null');},get prints(){return prints;},el:id=>nodes.get(id),list:selector=>lists.get(selector)||[],async flush(){await new Promise(setImmediate);},async route(value){location.hash=value;await this.flush();},async click(id){await nodes.get(id).fire('click');await this.flush();},async form(id,fields){const node=nodes.get(id);node.fields=fields;await node.fire('submit');await this.flush();}};
}

test('new student: details, answer entry, editable review and acknowledged submit',async()=>{
 const h=app({hash:'#/start'});assert.match(h.html,/<h1>اطلاعات دانشجو<\/h1>/);assert.equal(h.calls.length,0);
 await h.form('participant-form',{name:'دانشجوی جدید',studentId:'۴۰۵۱۲۳۴۵۶',read:'no'});assert.match(h.html,/question-form/);
 for(let i=0;i<D.experiments.length;i++){await h.route('#/question/'+i);for(const q of D.experiments[i].questions)await h.el('question-form').fire('input',{target:{name:q.id,value:q.type==='choice'?q.options[0].value:String(q.min)}});await h.form('question-form',{});}
 assert.equal(h.location.hash,'#/review');assert.equal(h.list('[data-edit]').every(b=>!b.disabled),true);
 const oldButton=h.el('submit-all');await h.click('submit-all');assert.equal(h.location.hash,'#/results');assert.equal(h.state.confirmed,true);assert.equal(h.state.receipt.id,h.state.record.id);assert.equal(h.calls.filter(c=>c.action==='submit').length,1);
 await oldButton.fire('click');assert.equal(h.calls.filter(c=>c.action==='submit').length,1);
});

test('draft refresh resumes paired questions, preserves answers and allows edits',async()=>{
 const s=draft();delete s.record.answers.loss;const h=app({hash:'#/question/3',stored:s});assert.match(h.html,/question-form/);assert.equal(h.state.record.id,s.record.id);assert.equal(h.state.record.answers.gain,s.record.answers.gain);await h.el('question-form').fire('input',{target:{name:'loss',value:'risky'}});assert.equal(h.state.record.answers.loss,'risky');assert.equal(h.calls.length,0);
 const restored=app({hash:'#/question/3',stored:h.state});assert.match(restored.html,/name="loss" value="risky" checked/);assert.equal(restored.state.confirmed,false);
});

test('confirmed legacy state: every initial URL renders results first, with no submit or write',()=>{
 const s=acknowledged();delete s.flowVersion;const raw=JSON.stringify(s);
 for(const route of ['','#/','#/start','#/question/0','#/question/9','#/question/999','#/review','#/guide','#/results','#/unknown','#old-path','#/future/new']){
  const h=app({hash:route,raw});assert.equal(h.location.hash,'#/results',route);assert.equal(h.renders.length,1);assert.equal((h.html.match(/class="result-card"/g)||[]).length,10);assert.doesNotMatch(h.html,/participant-form|question-form|submit-all|data-edit/);assert.equal(h.calls.length,0);assert.equal(h.memory.get(key),raw);assert.equal(h.replacements.length,route==='#/results'?0:1);
 }
});

test('confirmed student cannot navigate via hashes or Back/Forward; no editable frame is rendered',async()=>{
 const h=app({stored:acknowledged()});for(const route of ['#/start','#/question/4','#/review','#/not-a-page','#/','#/results']){await h.route(route);assert.equal(h.location.hash,'#/results');}assert.ok(h.renders.every(html=>html.includes('class="result-card"')&&!/participant-form|question-form|submit-all/.test(html)));assert.equal(h.calls.length,0);assert.ok(h.replacements.length<10);
});

test('answer presence or untrusted confirmation alone is never treated as successful registration',()=>{
 for(const patch of [{confirmed:false},{confirmed:'true'},{confirmed:true,receipt:null},{confirmed:true,receipt:{id:'wrong',receivedAt:'2026-10-19T10:10:01.000Z'}}]){
  const s={...acknowledged(),...patch};const h=app({hash:'#/review',stored:s});assert.notEqual(h.location.hash,'#/results');assert.doesNotMatch(h.html,/class="result-card"/);assert.equal(h.calls.length,0);
 }
});

test('lost acknowledgement: all automatic and manual retries preserve the exact request across reload',async()=>{
 const s=draft();s.flowVersion=1;s.record.order=C.makeOrder(()=>.7);const server=new Map();let available=false;
 function handle(action,payload){assert.equal(action,'submit');const previous=server.get(payload.id);if(previous)assert.deepEqual(payload,previous);else server.set(payload.id,copy(payload));if(!available)throw failure('Acknowledgement lost',true);return ack(payload);}
 const h=app({hash:'#/review',stored:s,handle});await h.click('submit-all');assert.equal(h.calls.length,5);const snapshot=h.calls[0].payload;assert.ok(h.calls.every(c=>JSON.stringify(c.payload)===JSON.stringify(snapshot)));assert.equal(h.state.confirmed,false);assert.deepEqual(h.state.record,snapshot);assert.ok(h.list('[data-edit]').every(b=>b.disabled));await h.route('#/question/1');assert.equal(h.location.hash,'#/review');assert.doesNotMatch(h.html,/question-form/);
 available=true;const retry=app({hash:'#/',stored:h.state,handle});assert.equal(retry.location.hash,'#/review');assert.equal(retry.calls.length,0);await retry.click('submit-all');assert.deepEqual(retry.calls[0].payload,snapshot);assert.equal(server.size,1);assert.equal(retry.state.confirmed,true);assert.equal(retry.location.hash,'#/results');
});

test('legacy pending snapshot skips draft-order migration and recovers a missing receipt idempotently',async()=>{
 const s=acknowledged();s.flowVersion=1;s.record.order=C.makeOrder(()=>.2);delete s.receipt;const snapshot=copy(s.record);const h=app({stored:s,handle:(_a,p)=>{assert.deepEqual(p,snapshot);return ack(p);}});assert.equal(h.location.hash,'#/review');assert.equal(h.memory.get(key),JSON.stringify(s));await h.click('submit-all');assert.equal(h.state.confirmed,true);assert.deepEqual(h.state.record,snapshot);
});

test('explicit first-attempt rejection remains editable; no false confirmation',async()=>{
 const s=draft(),h=app({hash:'#/review',stored:s,handle:()=>{throw failure('شماره دانشجویی تکراری است',false);}});await h.click('submit-all');assert.equal(h.state.confirmed,false);assert.equal(h.state.record.completedAt,undefined);assert.match(h.el('submit-status').textContent,/تکراری/);assert.ok(h.list('[data-edit]').every(b=>!b.disabled));await h.route('#/question/0');assert.match(h.html,/question-form/);
});

test('malformed acknowledgements do not unlock results or modify the retry snapshot',async()=>{
 const h=app({hash:'#/review',stored:draft(),handle:(_a,p)=>({ok:true,id:'wrong',receivedAt:'invalid'})});await h.click('submit-all');assert.equal(h.state.confirmed,false);assert.equal(h.calls.length,5);assert.equal(h.location.hash,'#/review');assert.ok(h.list('[data-edit]').every(b=>b.disabled));
});

test('route changes during an in-flight write cannot expose an editor or alter the payload',async()=>{
 let resolve;const h=app({hash:'#/review',stored:draft(),handle:()=>new Promise(r=>{resolve=r;})});const submission=h.el('submit-all').fire('click');await h.flush();const snapshot=copy(h.calls[0].payload);await h.route('#/question/2');assert.equal(h.location.hash,'#/review');assert.doesNotMatch(h.html,/question-form/);resolve(ack(snapshot));await submission;await h.flush();assert.equal(h.location.hash,'#/results');assert.deepEqual(h.state.record,snapshot);
});

test('aggregate refresh, downloads and printing survive return; errors never clear confirmed state',async()=>{
 for(const error of ['سرویس موقتاً در دسترس نیست','برای دیدن آمار، ابتدا پاسخ نهایی خود را ثبت کنید.']){
  const s=acknowledged(),h=app({stored:s,handle:()=>{throw failure(error,true);}});await h.click('refresh-aggregate');assert.equal(h.calls[0].action,'aggregate');assert.equal(h.state.confirmed,true);assert.deepEqual(h.state.receipt,s.receipt);assert.deepEqual(h.state.record,s.record);assert.equal(h.location.hash,'#/results');assert.match(h.html,/class="result-card"/);await h.click('download-results');assert.equal(h.downloads[0].download,'my-choices.json');assert.deepEqual(JSON.parse(await h.blobs[0].text()),{receipt:s.receipt,record:s.record});await h.click('print-results');assert.equal(h.prints,1);
 }
 const s=acknowledged(),a=C.summarize(Array.from({length:6},()=>s.record)),h=app({stored:s,handle:()=>({ok:true,aggregate:a})});await h.click('refresh-aggregate');assert.equal(h.state.aggregate.n,6);assert.equal(h.state.confirmed,true);assert.equal(h.calls.length,1);await h.route('#/start');assert.equal(h.calls.length,1);
});

test('corrupt storage is preserved byte-for-byte with a safe recovery view on all routes',async()=>{
 const bad=[ 'not json','{',JSON.stringify([]),JSON.stringify({record:null}),...[
  s=>{s.record.participant=null;},s=>{s.record.answers=[];},s=>{delete s.record.answers.gain;},s=>{s.record.order=['unknown'];},s=>{s.record.version='old';},s=>{s.record.id='bad';},s=>{s.record.startedAt='bad';},s=>{s.receipt.receivedAt={};s.record.completedAt=null;}
 ].map(mutate=>{const s=acknowledged();mutate(s);return JSON.stringify(s);})];
 for(const raw of bad){const h=app({hash:'#/question/0',raw});assert.match(h.html,/بازیابی اطلاعات/);assert.equal(h.memory.get(key),raw);assert.equal(h.calls.length,0);await h.route('#/review');assert.match(h.html,/بازیابی اطلاعات/);await h.click('download-saved');assert.equal(await h.blobs[0].text(),raw);assert.equal(h.memory.get(key),raw);assert.ok(h.replacements.length<3);}
 const unavailable=app({hash:'#/start',blockedStorage:true});assert.match(unavailable.html,/participant-form/);assert.match(unavailable.html,/storage-warning/);
});

test('incomplete draft participant and timings recover through the existing details form',async()=>{
 const s=draft();s.record.participant={studentId:'405123456'};delete s.record.timings;const h=app({hash:'#/question/2',stored:s});await h.flush();assert.match(h.html,/participant-form/);await h.form('participant-form',{name:'نام تکمیل‌شده',studentId:'405123456',read:'yes'});assert.match(h.html,/question-form/);assert.deepEqual(h.state.record.answers,s.record.answers);assert.equal(h.state.record.id,s.record.id);
});

test('bad cached class data never prevents individual analysis or destroys a valid receipt',async()=>{
 for(const cached of [null,[],{n:6,withheld:false,questions:{},experiments:{}},(()=>{const a=C.summarize(Array.from({length:6},()=>record()));a.anchor.points={};return a;})()]){
  const s=acknowledged();s.aggregate=cached;const h=app({stored:s,handle:()=>({ok:true,aggregate:[]})});assert.equal((h.html.match(/class="result-card"/g)||[]).length,10);await h.click('refresh-aggregate');assert.equal(h.state.confirmed,true);assert.deepEqual(h.state.receipt,s.receipt);assert.equal(h.location.hash,'#/results');
 }
});

test('another device remains unconfirmed when the backend rejects its duplicate student ID',async()=>{
 const first=acknowledged(),second=draft();second.record.participant.studentId=first.record.participant.studentId;const h=app({hash:'#/review',stored:second,handle:()=>{throw failure('برای این شمارهٔ دانشجویی قبلاً پاسخ ثبت شده است.',false);}});await h.click('submit-all');assert.equal(h.state.confirmed,false);assert.equal(h.state.record.id,second.record.id);assert.notEqual(h.state.record.id,first.record.id);assert.match(h.el('submit-status').textContent,/قبلاً/);
});

test('closed registration does not affect an acknowledged return or trigger another submission',async()=>{
 const h=app({stored:acknowledged(),handle:action=>{if(action==='submit')throw failure('ثبت بسته است',false);return {ok:true,aggregate:C.summarize([record()])};}});assert.equal(h.location.hash,'#/results');assert.equal(h.calls.length,0);await h.click('refresh-aggregate');assert.ok(h.calls.every(c=>c.action==='aggregate'));assert.equal(h.state.confirmed,true);
});

test('a successful registration in another tab engages the same central route guard',async()=>{
 const s=acknowledged(),h=app({hash:'#/question/0',stored:draft()});await h.emit('storage',{key,newValue:JSON.stringify(s)});assert.equal(h.location.hash,'#/results');await h.route('#/review');assert.equal(h.location.hash,'#/results');assert.equal(h.calls.length,0);
});

test('the browser title contains only the requested site name',()=>{assert.match(fs.readFileSync('index.html','utf8'),/<title>آزمایشگاه انتخاب<\/title>/);});


test('a rejection after an ambiguous automatic attempt cannot reopen the original snapshot',async()=>{
 let count=0;const h=app({hash:'#/review',stored:draft(),handle:()=>{throw failure(++count===1?'ack lost':'temporarily closed',count===1);}});await h.click('submit-all');assert.equal(h.calls.length,2);assert.ok(h.state.record.completedAt);assert.ok(h.list('[data-edit]').every(b=>b.disabled));await h.route('#/question/0');assert.equal(h.location.hash,'#/review');assert.deepEqual(h.state.record,h.calls[0].payload);
});

test('all personalized findings are restored without changing answers or receipt',()=>{
 const s=acknowledged(),h=app({stored:s});for(const e of D.experiments){assert.ok(h.html.includes(C.analyze(e.id,C.withAnchor(s.record)).title));}assert.equal(h.memory.get(key),JSON.stringify(s));
});

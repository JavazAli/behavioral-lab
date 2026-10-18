import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.pdf':'application/pdf','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);if(pathname.startsWith('/behavioral-lab/'))pathname=pathname.slice('/behavioral-lab'.length);if(pathname.endsWith('/'))pathname+='index.html';const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep)||pathname.split('/').some(s=>s.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}if(!(await stat(file)).isFile())throw new Error();res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));}catch(_){res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/behavioral-lab/'));

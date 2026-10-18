import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url),output=new URL('../tmp/pages/',import.meta.url);
await mkdir(output,{recursive:true});
for(const entry of ['index.html','config.js','.nojekyll','assets','materials']) await cp(new URL(entry,root),new URL(entry,output),{recursive:true});
// Content fingerprints prevent returning students from loading an old interface.
let html=await readFile(new URL('index.html',output),'utf8');
for(const file of ['assets/styles.css','assets/app.js','assets/data.js','assets/core.js','assets/transport.js','config.js']){
  const hash=createHash('sha256').update(await readFile(new URL(file,output))).digest('hex').slice(0,12);
  const attribute=new RegExp('((?:src|href)=")'+file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?[^" ]*)?"','g');
  html=html.replace(attribute,'$1'+file+'?v='+hash+'"');
}
await writeFile(new URL('index.html',output),html);
console.log('GitHub Pages artifact ready: tmp/pages (public website files, fingerprinted assets).');

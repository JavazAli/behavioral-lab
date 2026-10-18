import { cp, mkdir } from 'node:fs/promises';
const root=new URL('../',import.meta.url),output=new URL('../tmp/pages/',import.meta.url);
await mkdir(output,{recursive:true});
for(const entry of ['index.html','config.js','.nojekyll','assets','materials']) await cp(new URL(entry,root),new URL(entry,output),{recursive:true});
console.log('GitHub Pages artifact ready: tmp/pages (public website files only).');

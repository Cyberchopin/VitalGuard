import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
let count=0;
for(const dir of ['dist','scripts','test'])for(const f of await readdir(new URL(dir+'/',root))){
  if(!f.endsWith('.mjs'))continue;
  const path=new URL(dir+'/'+f,root);
  const result=spawnSync(process.execPath,['--check',fileURLToPath(path)],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);count++;
  const source=await readFile(path,'utf8');
  for(const match of source.matchAll(/from\s+['"]([.][^'"]+)['"]/g))await access(new URL(match[1],path));
}
const html=await readFile(new URL('dist/index.html',root),'utf8');
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await access(new URL(match[1],new URL('dist/index.html',root)));
console.log(`Checked ${count} JavaScript modules, imports and HTML local assets.`);

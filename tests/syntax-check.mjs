/** Check every production JavaScript file using the current Node parser. */
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(resolve(root,'src')).filter(x=>x.endsWith('.js')).sort().map(x=>`src/${x}`);
files.push('sw.js');
for(const file of files){
 const result=spawnSync(process.execPath,['--check',resolve(root,file)],{encoding:'utf8'});
 if(result.status!==0){console.error(`Syntax failed: ${file}\n${result.stderr||result.stdout}`);process.exit(1);}
}
console.log(`Syntax check passed for ${files.length} application JavaScript files.`);

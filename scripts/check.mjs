import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
for(const file of readdirSync(new URL('../dist/js/',import.meta.url)).filter(name=>name.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../dist/js/'+file,import.meta.url))],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log('PASS: syntax for every application module.');

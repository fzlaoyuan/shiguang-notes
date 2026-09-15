const path=require('node:path');const fs=require('node:fs');const {spawnSync}=require('node:child_process');
process.chdir(path.resolve(__dirname,'..'));
require('./icon.cjs');require('./build.cjs');
const env={...process.env};if(fs.existsSync('.tools/npm.cmd')){const key=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';env[key]=path.resolve('.tools')+path.delimiter+path.dirname(process.execPath)+path.delimiter+(env[key]||'');}
const result=spawnSync(process.execPath,['node_modules/electron-builder/cli.js','--win','dir'],{env,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
for(const file of ['README.md','LICENSE','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(file,path.join('release/win-unpacked',file));

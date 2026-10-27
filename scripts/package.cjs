const path=require('node:path');const fs=require('node:fs');const {spawnSync}=require('node:child_process');
process.chdir(path.resolve(__dirname,'..'));
require('./icon.cjs');require('./build.cjs');
const env={...process.env};if(fs.existsSync('.tools/npm.cmd')){const key=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';env[key]=path.resolve('.tools')+path.delimiter+path.dirname(process.execPath)+path.delimiter+(env[key]||'');}
const installer=process.argv.includes('--installer');
const args=['node_modules/electron-builder/cli.js','--win',installer?'nsis':'dir','--x64'];
if(installer)args.push('--config.directories.output=release/installer');
const result=spawnSync(process.execPath,args,{env,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
for(const file of ['README.md','README.en.md','LICENSE','LICENSE-MIT-1.0.0','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(file,path.join(installer?'release/installer/win-unpacked':'release/win-unpacked',file));

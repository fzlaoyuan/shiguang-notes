const fs = require('node:fs');
const esbuild = require('esbuild');
fs.mkdirSync('dist', { recursive: true });
const result=esbuild.buildSync({entryPoints:['src/renderer.js'], bundle:true, outfile:'dist/renderer.js', minify:true, sourcemap:true, metafile:true});
const packages=new Set(Object.keys(result.metafile.inputs).filter(f=>f.startsWith('node_modules/')).map(f=>{const p=f.split('/');return p[1].startsWith('@')?p.slice(0,3).join('/'):p.slice(0,2).join('/');}));
let notices='# Third-party notices\n\nElectron and Chromium notices are distributed alongside the executable.\n\n';
for(const dir of [...packages].sort()){
  const p=JSON.parse(fs.readFileSync(dir+'/package.json','utf8'));
  const license=fs.readdirSync(dir).find(f=>/^licen[cs]e(?:\.(?:md|txt))?$/i.test(f));
  notices+=`## ${p.name} ${p.version}\n\n${license?fs.readFileSync(dir+'/'+license,'utf8'):'License: '+p.license+'\n'+(p.repository?.url||'')}\n\n`;
}
fs.writeFileSync('THIRD_PARTY_NOTICES.md',notices.trimEnd()+'\n');
for (const file of ['index.html','style.css']) fs.copyFileSync('src/'+file,'dist/'+file);

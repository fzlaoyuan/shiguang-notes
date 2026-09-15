// Draw a small code-native notebook icon and encode PNG + ICO without external tools.
const fs=require('node:fs');const zlib=require('node:zlib');
function crc32(buf){let c=0xffffffff;for(const byte of buf){c^=byte;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(name,data){const kind=Buffer.from(name);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);kind.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([kind,data])),out.length-4);return out;}
const size=256,raw=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const pos=y*(size*4+1)+1+x*4;const rounded=x>=20&&x<236&&y>=20&&y<236&&Math.hypot(Math.max(45-x,0,x-210),Math.max(45-y,0,y-210))<26;let rgb=[68,113,85];const paper=x>=73&&x<=178&&y>=59&&y<=195;const border=paper&&(x<80||x>171||y<66||y>188);const line=x>=98&&x<=157&&((y>=92&&y<=98)||(y>=119&&y<=125)||(y>=146&&y<=152));const binding=x>=62&&x<=88&&((y>=84&&y<=91)||(y>=120&&y<=127)||(y>=156&&y<=163));if(border||line||binding)rgb=[243,248,236];raw[pos]=rgb[0];raw[pos+1]=rgb[1];raw[pos+2]=rgb[2];raw[pos+3]=rounded?255:0;}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
fs.mkdirSync('assets',{recursive:true});fs.writeFileSync('assets/icon.png',png);fs.writeFileSync('assets/icon.ico',Buffer.concat([header,png]));

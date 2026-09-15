const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const id = () => crypto.randomUUID();
function seed() {
  const now = new Date().toISOString();
  return { version: 1, folders: [{id:'inbox', name:'随手记'},{id:'ideas',name:'灵感收藏'},{id:'work',name:'工作笔记'}], notes: [{id:id(), folderId:'inbox', title:'让每一个灵感，都有地方停留', html:'<p>欢迎来到 <strong>拾光便签</strong>。这是属于你的本地记录空间。</p><h2>从一个小小的想法开始</h2><p>记下今天的灵感、整理工作资料，或者为明天列一份清单。所有内容都会自动保存在这台电脑上。</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>写下第一个想法</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>粘贴一张图片，留住灵感</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>把便签悬浮在桌面上</p></div></li></ul><blockquote><p>不必组织好语言，先记录下来。</p></blockquote><p>小提示：Ctrl + N 新建便签 · Ctrl + K 搜索 · Ctrl + V 粘贴图片</p>',text:'欢迎来到拾光便签。这是属于你的本地记录空间。记下今天的灵感、整理工作资料，或者为明天列一份清单。',color:'sage',pinned:true,createdAt:now,updatedAt:now,deletedAt:null}],settings:{theme:'light'}};
}
function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.folders) || !data.folders.length) throw new Error('不是有效的拾光便签备份文件');
  const folderIds = new Set(); const noteIds = new Set();
  for (const f of data.folders) {
    if (!f || typeof f.id !== 'string' || !f.id || folderIds.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || f.name.length>80) throw new Error('分组数据无效');
    folderIds.add(f.id);
  }
  for (const n of data.notes) {
    if (!n || typeof n.id !== 'string' || !n.id || noteIds.has(n.id) || typeof n.html !== 'string' || typeof n.title !== 'string' || typeof n.text !== 'string' || !folderIds.has(n.folderId) || !Number.isFinite(Date.parse(n.createdAt)) || !Number.isFinite(Date.parse(n.updatedAt)) || (n.deletedAt && !Number.isFinite(Date.parse(n.deletedAt)))) throw new Error('便签数据无效');
    noteIds.add(n.id);
  }
  return data;
}
class Store {
  constructor(dir) {this.dir=dir;this.file=path.join(dir,'notes.json');fs.mkdirSync(dir,{recursive:true});this.recovered=false;this.lastBackup=0;this.data=this.load();}
  load() {
    if (!fs.existsSync(this.file)) {const d=seed();this.write(d);return d;}
    try {return validate(JSON.parse(fs.readFileSync(this.file,'utf8')));} catch(err) {
      const candidates=fs.readdirSync(this.dir).filter(f=>/^backup-.*\.json$/.test(f)).sort().reverse();
      for(const f of candidates) {try {const d=validate(JSON.parse(fs.readFileSync(path.join(this.dir,f),'utf8')));fs.copyFileSync(this.file,path.join(this.dir,`damaged-${Date.now()}.json`));this.recovered=true;this.write(d);return d;}catch{}}
      throw new Error('数据文件无法读取，原文件已保留。请从备份恢复：'+this.dir, {cause:err});
    }
  }
  write(data) {
    validate(data);
    const temp=this.file+'.tmp';
    const fd=fs.openSync(temp,'w');
    try {fs.writeFileSync(fd,JSON.stringify(data,null,2),'utf8');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    fs.renameSync(temp,this.file);
  }
  backup() {
    if (!fs.existsSync(this.file)) return;
    fs.copyFileSync(this.file,path.join(this.dir,`backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`));
    const files=fs.readdirSync(this.dir).filter(f=>/^backup-.*\.json$/.test(f)).sort().reverse();
    for (const f of files.slice(30)) fs.unlinkSync(path.join(this.dir,f));
    this.lastBackup=Date.now();
  }
  commit(next) {validate(next);if(Date.now()-this.lastBackup>15*60*1000)this.backup();this.write(next);this.data=next;return this.data;}
  change(action) {
    const d=structuredClone(this.data); const now=new Date().toISOString();
    const n=d.notes.find(n=>n.id===action.id);
    switch(action.type) {
      case 'create': {const folderId=d.folders.some(f=>f.id===action.folderId)?action.folderId:d.folders[0].id;d.notes.unshift({id:id(),folderId,title:'',html:'<p></p>',text:'',color:'sage',pinned:false,createdAt:now,updatedAt:now,deletedAt:null});break;}
      case 'update': if(!n)throw new Error('便签不存在');for(const key of ['title','html','text','color','pinned','folderId'])if(Object.hasOwn(action.patch,key))n[key]=action.patch[key];n.updatedAt=now;break;
      case 'trash': if(n){n.deletedAt=now;n.updatedAt=now;}break;
      case 'restore': if(n){n.deletedAt=null;n.updatedAt=now;}break;
      case 'delete': if(n?.deletedAt)d.notes=d.notes.filter(x=>x.id!==n.id);break;
      case 'folder-add': if(!action.name?.trim())throw new Error('请输入分组名称');d.folders.push({id:id(),name:action.name.trim()});break;
      case 'folder-rename': {const f=d.folders.find(f=>f.id===action.id);if(f)f.name=action.name.trim();break;}
      case 'folder-delete': if(d.folders.length<2)throw new Error('至少保留一个分组');d.folders=d.folders.filter(f=>f.id!==action.id);for(const note of d.notes)if(note.folderId===action.id)note.folderId=d.folders[0].id;break;
      case 'settings': d.settings={...d.settings,...action.patch};break;
      default: throw new Error('未知操作');
    }
    return this.commit(d);
  }
  merge(incoming) {
    validate(incoming); this.backup(); const d=structuredClone(this.data); const mapping=new Map();
    for(const f of incoming.folders){const existing=d.folders.find(x=>x.name===f.name);const newId=existing?.id||id();mapping.set(f.id,newId);if(!existing)d.folders.push({...f,id:newId});}
    for(const n of incoming.notes)d.notes.push({...n,id:id(),folderId:mapping.get(n.folderId)});
    return this.commit(d);
  }
}
module.exports={Store,validate,seed};

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store,validate}=require('../src/store.cjs');
function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiguang-lock-unit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Store(dir);}
test('密码加密正文和图片，窗口独立解锁；重新打开不保留解锁状态',async t=>{
 const s=setup(t),id=s.data.notes[0].id,secret='不能明文落盘的秘密',html='<p>'+secret+'</p><img src="data:image/png;base64,SECRETIMAGE">';
 s.change({type:'update',id,patch:{html,text:secret}});await s.setLock(id,'正确密码123');
 assert.equal(s.data.version,2);assert.ok(s.data.notes[0].lock);assert.equal(s.data.notes[0].html,'');assert.equal(s.data.notes[0].text,'');
 assert.ok(!fs.readFileSync(s.file,'utf8').includes(secret));
 const latest=fs.readdirSync(s.dir).filter(f=>f.startsWith('backup-')).sort().at(-1);assert.ok(!fs.readFileSync(path.join(s.dir,latest),'utf8').includes(secret));
 assert.equal(s.view().notes[0].html,'');assert.equal(s.view().notes[0].lock,undefined);
 assert.throws(()=>s.body(id),/解锁/);assert.throws(()=>s.change({type:'update',id,patch:{title:'禁止修改'}}),/解锁/);
 const first=new Map(),second=new Map();await assert.rejects(s.unlock(id,'错误密码123',first),/密码不正确/);assert.equal(first.size,0);
 await s.unlock(id,'正确密码123',first);assert.equal(s.view(first).notes[0].html,html);assert.equal(s.view(second).notes[0].html,'');
 s.change({type:'update',id,patch:{text:secret+'修改',html:'<p>'+secret+'修改</p>'}},first);assert.ok(!fs.readFileSync(s.file,'utf8').includes(secret));
 s.relock(id,first);assert.equal(first.size,0);assert.equal(s.view(first).notes[0].html,'');
 const reopened=new Store(s.dir);assert.equal(reopened.view().notes[0].unlocked,false);await reopened.unlock(id,'正确密码123',second);assert.equal(reopened.body(id,second).text,secret+'修改');
});
test('加锁便签移动、分组删除、复制、回收与导入均保持加密',async t=>{
 const s=setup(t),id=s.data.notes[0].id;await s.setLock(id,'迁移密码123');const payload=structuredClone(s.note(id).lock);
 s.change({type:'move',id,folderId:'work'});assert.deepEqual(s.note(id).lock,payload);s.change({type:'folder-delete',id:'work'});assert.equal(s.note(id).folderId,'inbox');
 s.change({type:'duplicate',id});const copyId=s.data.notes[0].id;assert.notEqual(copyId,id);assert.ok(s.note(copyId).lock);assert.equal(s.view().notes[0].html,'');
 s.change({type:'trash',id});s.change({type:'restore',id});assert.deepEqual(s.note(id).lock,payload);
 const imported=setup(t);imported.merge(JSON.parse(JSON.stringify(s.data)));assert.equal(imported.data.version,2);const importedNote=imported.data.notes.find(n=>n.lock);const session=new Map();await imported.unlock(importedNote.id,'迁移密码123',session);assert.ok(imported.body(importedNote.id,session).html.includes('拾光便签'));
 const before=fs.readFileSync(s.file,'utf8');assert.throws(()=>s.change({type:'move',id,folderId:'missing'}));assert.equal(fs.readFileSync(s.file,'utf8'),before);
});
test('密码移除需验证；无效锁、密文篡改与弱密码不能绕过校验',async t=>{
 const s=setup(t),id=s.data.notes[0].id;const html=s.note(id).html;
 await assert.rejects(s.setLock(id,'123'),/6/);assert.equal(s.data.version,1);
 await s.setLock(id,'验证密码123');const original=structuredClone(s.data);await assert.rejects(s.removeLock(id,'其他密码123'),/密码不正确/);assert.ok(s.note(id).lock);
 const bad=structuredClone(s.data);bad.notes[0].html='泄露';assert.throws(()=>validate(bad),/便签锁/);
 const bad2=structuredClone(s.data);bad2.notes[0].lock.iv='invalid';assert.throws(()=>validate(bad2),/便签锁/);
 s.note(id).lock.tag=Buffer.alloc(16).toString('base64');await assert.rejects(s.unlock(id,'验证密码123',new Map()),/损坏/);s.data=original;
 await s.removeLock(id,'验证密码123');assert.equal(s.note(id).lock,undefined);assert.equal(s.note(id).html,html);
});

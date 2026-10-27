const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiguang-features-'));
const password='便签测试密码123',secret='唯一秘密_保密计划9281',errors=[];let app;
const file=path.join(dir,'data/notes.json');const disk=()=>JSON.parse(fs.readFileSync(file,'utf8'));
async function launch(){const env={...process.env,SHIGUANG_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;app=await electron.launch(process.argv[2]?{executablePath:path.resolve(process.argv[2]),args:['--test-mode'],env}:{args:[root,'--test-mode'],env});const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));await p.locator('#note-title').waitFor();return p;}
async function save(p){await p.keyboard.press('Control+s');await p.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('已保存'));}
async function passwordSubmit(p,value){await p.locator('#note-password').fill(value);await p.locator('#dialog button[type=submit]').click();if(value==='错误密码123')await p.locator('#password-error').waitFor({state:'visible'});}
async function unlock(p){await p.locator('#unlock-note').click();await passwordSubmit(p,password);await p.waitForFunction(()=>!document.querySelector('#dialog').open);await p.locator('#document').waitFor({state:'visible'});}
(async()=>{try{
 let p=await launch();await p.waitForFunction(()=>document.querySelector('#note-title').value.length>0);
 await p.locator('#new-note').click();await p.locator('#note-title').fill('项目会议 · 预算计划');await p.locator('.tiptap').fill('上海 团队 会议 预算 a.b <img> '+secret);await save(p);const id=disk().notes[0].id;
 await p.locator('#note-folder').selectOption('work');await p.locator('[data-view="folder:inbox"]').click();
 await p.locator('#search').fill('上海 预算');await p.waitForFunction(()=>document.querySelectorAll('.note-card').length===1);assert.match(await p.locator('.note-card').innerText(),/项目会议/);assert.ok(await p.locator('.card-preview mark').count()>=2);
 await p.locator('#search-scope').selectOption('view');await p.waitForFunction(()=>document.querySelectorAll('.note-card').length===0);
 await p.locator('#search-scope').selectOption('all');await p.locator('#search').fill('a.b');await p.waitForFunction(()=>document.querySelectorAll('.note-card').length===1);assert.equal(await p.locator('.card-preview mark').innerText(),'a.b');
 await p.locator('#search').fill('<img>');await p.waitForFunction(()=>document.querySelectorAll('.note-card').length===1);assert.equal(await p.locator('.card-preview img').count(),0);
 await p.locator('#clear-search').click();await p.locator('[data-view=all]').click();
 let card=p.locator(`[data-note="${id}"]`);await card.click({button:'right'});await p.locator('[data-menu-action=move]').click();await p.locator('#move-folder').selectOption('ideas');await p.locator('#dialog button[type=submit]').click();await p.waitForFunction(id=>document.querySelector('#breadcrumb').textContent==='灵感收藏',id);assert.equal(disk().notes.find(n=>n.id===id).folderId,'ideas');
 await p.locator(`[data-note="${id}"]`).dragTo(p.locator('[data-drop-folder=work]'));await p.waitForFunction(()=>document.querySelector('#breadcrumb').textContent==='工作笔记');assert.equal(disk().notes.find(n=>n.id===id).folderId,'work');
 await p.locator('#lock-note').click();await p.locator('#note-password').fill(password);await p.locator('#confirm-password').fill('不同密码123');await p.locator('#dialog button[type=submit]').click();assert.match(await p.locator('#password-error').innerText(),/不一致/);
 await p.locator('#confirm-password').fill(password);await p.locator('#dialog button[type=submit]').click();await p.locator('#locked-editor').waitFor({state:'visible'});
 assert.equal(await p.locator('.tiptap').innerText(),'');assert.ok(!(await card.innerText()).includes(secret));assert.ok(!fs.readFileSync(file,'utf8').includes(secret));assert.ok(disk().notes.find(n=>n.id===id).lock);
 const snapshot=await p.evaluate(()=>window.notesAPI.load());const hidden=snapshot.data.notes.find(n=>n.id===id);assert.equal(hidden.html,'');assert.equal(hidden.lock,undefined);
 await p.locator('#search').fill(secret);await p.waitForFunction(()=>document.querySelectorAll('.note-card').length===0);await p.locator('#clear-search').click();await p.locator(`[data-note="${id}"]`).click();
 await p.locator('#unlock-note').click();await passwordSubmit(p,'错误密码123');assert.match(await p.locator('#password-error').innerText(),/密码不正确/);await passwordSubmit(p,password);await p.locator('#document').waitFor();assert.match(await p.locator('.tiptap').innerText(),new RegExp(secret));
 await p.locator('.tiptap').fill(secret+' 编辑后保留');await save(p);assert.ok(!fs.readFileSync(file,'utf8').includes(secret));
 await p.locator('.tiptap').fill(secret+' 新建前的未保存编辑');await p.locator('#new-note').click();await p.locator(`[data-note="${id}"]`).click();await p.locator('#locked-editor').waitFor();await unlock(p);assert.match(await p.locator('.tiptap').innerText(),/新建前的未保存编辑/);
 // Newly opened floating windows must independently require a password.
 const floatingPromise=app.waitForEvent('window');await p.locator('#float-note').click();const floating=await floatingPromise;await floating.locator('#locked-editor').waitFor();await unlock(floating);
 await floating.locator('.tiptap').fill(secret+' 悬浮窗口最新内容');
 await p.locator('#lock-note').click();await p.locator('[data-menu-action=lock-now]').click();await p.locator('#locked-editor').waitFor();await floating.locator('#locked-editor').waitFor();assert.equal(await floating.locator('.tiptap').innerText(),'');
 await unlock(p);assert.match(await p.locator('.tiptap').innerText(),/悬浮窗口最新内容/);
 await p.locator('#new-note').click();await p.locator('#note-title').fill('其他窗口的独立便签');await p.locator('.tiptap').fill('其他窗口加锁时也要保留的编辑');
 await unlock(floating);await floating.locator('#lock-note').click();await floating.locator('[data-menu-action=lock-now]').click();await floating.locator('#locked-editor').waitFor();
 assert.equal(await p.locator('#note-title').inputValue(),'其他窗口的独立便签');assert.equal(await p.locator('.tiptap').innerText(),'其他窗口加锁时也要保留的编辑');await save(p);
 await p.locator(`[data-note="${id}"]`).click();await p.locator('#locked-editor').waitFor();await unlock(p);
 // A duplicate keeps its encrypted payload even when the source is unlocked.
 await p.locator('#note-menu').click();await p.locator('[data-menu-action=duplicate]').click();await p.locator('#locked-editor').waitFor();assert.ok(disk().notes[0].lock);
 await p.locator(`[data-note="${id}"]`).click();await p.locator('#locked-editor').waitFor();await unlock(p);
 // Switching away removes this window's key and clears undo history.
 await p.locator('.note-card').filter({hasText:'让每一个灵感'}).click();await p.locator('.tiptap').click();await p.keyboard.press('Control+z');assert.ok(!(await p.locator('.tiptap').innerText()).includes(secret));await p.locator(`[data-note="${id}"]`).click();await p.locator('#locked-editor').waitFor();
 // Password protection survives a backup export and additive import.
 const backup=path.join(dir,'full-backup.json');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},backup);
 await p.locator('#settings-button').click();await p.locator('[data-setting=export]').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('完整备份'));assert.ok(!fs.readFileSync(backup,'utf8').includes(secret));
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},backup);await p.locator('[data-setting=import]').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('现有内容已保留'));await p.locator('#dialog-close').click();
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await p.screenshot({path:path.join(root,'test-results/features-locked.png')});
 await floating.locator('[data-window=close]').click();await app.close();p=await launch();await p.locator(`[data-note="${id}"]`).click();await p.locator('#locked-editor').waitFor();
 const denied=await p.evaluate(async id=>{try{await window.notesAPI.exportNote(id,'txt');return false;}catch{return true;}},id);assert.equal(denied,true);
 await unlock(p);await p.locator('#note-menu').click();await p.locator('[data-menu-action=remove-lock]').click();await passwordSubmit(p,'错误密码123');assert.match(await p.locator('#password-error').innerText(),/密码不正确/);await passwordSubmit(p,password);await p.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal(disk().notes.find(n=>n.id===id).lock,undefined);
 // Context delete must move only the targeted note to trash; restore keeps its group.
 await p.locator(`[data-note="${id}"]`).click({button:'right'});await p.locator('[data-menu-action=trash]').click();await p.waitForFunction(id=>!document.querySelector(`[data-note="${id}"]`),id);assert.ok(disk().notes.find(n=>n.id===id).deletedAt);
 await p.locator('[data-view=trash]').click();await p.locator(`[data-note="${id}"]`).click({button:'right'});await p.locator('[data-menu-action=restore]').click();assert.equal(disk().notes.find(n=>n.id===id).deletedAt,null);
 assert.deepEqual(errors,[]);console.log('PASS: global/multi-keyword/literal search, context move/delete/restore, native drag move, encrypted lock/edit/duplicate/export/import/restart, wrong passwords, independent floating unlock, flush-before-lock, no undo leak.');console.log('Test data: '+dir);
}finally{if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

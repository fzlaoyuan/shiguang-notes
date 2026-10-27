const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {contacts}=require('../src/contacts.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiguang-contacts-'));
 const env={...process.env,SHIGUANG_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
 const launch=process.argv[2]?{executablePath:path.resolve(process.argv[2]),args:['--test-mode'],env}:{args:[root,'--test-mode'],env};
 const app=await electron.launch(launch);
 try{
  const p=await app.firstWindow();await p.waitForFunction(()=>document.querySelector('#note-title')?.value.length>0);
  await app.evaluate(({shell})=>{globalThis.contactCalls=[];shell.openExternal=async url=>{globalThis.contactCalls.push(url);};});
  const file=path.join(dir,'data/notes.json'),before=fs.readFileSync(file,'utf8');
  assert.match(await p.locator('.copyright-note').innerText(),/免费软件 · 禁止商业用途/);
  assert.equal(await p.locator('.contact-actions a').count(),2);
  for(const [key,item] of Object.entries(contacts)){
   const link=p.locator(`.sidebar [data-contact=${key}]`);
   assert.equal(await link.innerText(),item.label);assert.equal(await link.getAttribute('href'),item.url);
   await link.click();assert.equal(await p.locator('#dialog').isVisible(),false);
  }
  assert.deepEqual(await app.evaluate(()=>globalThis.contactCalls),Object.values(contacts).map(v=>v.url));
  await p.locator('#contact-author').focus();await p.keyboard.press('Enter');
  assert.deepEqual(await app.evaluate(()=>globalThis.contactCalls),[contacts.author.url,contacts.feedback.url,contacts.author.url]);
  for(const key of ['email','douyin','file:///C:/Windows/system32/cmd.exe','https://example.com','__proto__',null,{}]){
   const rejected=await p.evaluate(async key=>{try{await window.notesAPI.openContact(key);return false;}catch{return true;}},key);
   assert.equal(rejected,true);
  }
  assert.equal(await app.evaluate(()=>globalThis.contactCalls.length),3);
  assert.equal(fs.readFileSync(file,'utf8'),before,'Contact actions must not change notes.');
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await p.screenshot({path:path.join(root,'test-results/contacts-light.png')});
  await p.screenshot({path:path.join(root,'test-results/contacts-main.png')});
  await p.locator('#settings-button').click();assert.ok((await p.locator('.settings-version').innerText()).includes(require('../package.json').version));
  await p.locator('[data-setting=theme]').click();await p.locator('#dialog-close').click();
  await p.locator('#contact-author').click();await p.screenshot({path:path.join(root,'test-results/contacts-dark.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,620));
  await p.locator('.sidebar [data-contact=feedback]').scrollIntoViewIfNeeded();
  assert.equal(await p.locator('.sidebar [data-contact=feedback]').isVisible(),true);await p.screenshot({path:path.join(root,'test-results/contacts-small.png')});
  await app.evaluate(({shell})=>{shell.openExternal=async()=>{throw new Error('测试：无法打开外部应用');};});
  await p.locator('.sidebar [data-contact=feedback]').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('无法打开外部应用'));
  console.log('PASS: two direct text links, correct destinations, keyboard activation, removed legacy contacts, unchanged notes, version, light/dark/minimum-size layouts, failure feedback.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

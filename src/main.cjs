const {app,BrowserWindow,ipcMain,dialog,shell,Menu,Tray,nativeImage,globalShortcut,session}=require('electron');
const fs=require('node:fs');const path=require('node:path');const {Store}=require('./store.cjs');
const testMode=process.argv.includes('--test-mode');
if(process.env.SHIGUANG_TEST_DATA && testMode)app.setPath('userData',process.env.SHIGUANG_TEST_DATA);
let store,mainWindow,tray,quitting=false;
const floats=new Map();
if(!app.requestSingleInstanceLock())app.quit();
else {
app.on('second-instance',()=>{mainWindow?.show();mainWindow?.focus();});
app.whenReady().then(()=>{
  try{store=new Store(path.join(app.getPath('userData'),'data'));}catch(e){dialog.showErrorBox('无法打开便签',e.message);app.quit();return;}
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,cb)=>cb({cancel:true}));
  mainWindow=createWindow();
  const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;const ink=x>9&&x<23&&((y>8&&y<11)||(y>14&&y<17)||(y>20&&y<23));pixels[i]=ink?244:91;pixels[i+1]=ink?248:118;pixels[i+2]=ink?246:58;pixels[i+3]=255;}
  tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));tray.setToolTip('拾光便签 · 灵感随手记');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'打开拾光便签',click:()=>mainWindow.show()},{label:'新建便签',click:()=>{mainWindow.show();mainWindow.webContents.send('new-note');}},{type:'separator'},{label:'退出',click:()=>app.quit()}]));tray.on('double-click',()=>mainWindow.show());
  if(!testMode)globalShortcut.register('CommandOrControl+Alt+N',()=>{mainWindow.show();mainWindow.focus();mainWindow.webContents.send('new-note');});
  if(store.recovered)dialog.showMessageBox(mainWindow,{type:'warning',message:'已从自动备份恢复便签',detail:'无法读取的原文件已保留在数据目录。请检查恢复的内容。'});
});
}
function createWindow(noteId) {
  const win=new BrowserWindow({width:noteId?440:1360,height:noteId?550:870,minWidth:noteId?320:980,minHeight:noteId?300:620,frame:false,show:false,icon:path.join(__dirname,'../assets/icon.ico'),backgroundColor:'#f8f9f6',title:noteId?'桌面便签 · 拾光':'拾光便签',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
  if(noteId)win.setAlwaysOnTop(true);
  win.loadFile(path.join(__dirname,'../dist/index.html'),{query:noteId?{note:noteId}:{}});
  win.once('ready-to-show',()=>win.show());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.on('close',e=>{if(win._allowClose)return;e.preventDefault();win.webContents.send('flush');});
  win.on('closed',()=>{if(noteId)floats.delete(noteId);});
  return win;
}
function broadcast(sender) {for(const win of BrowserWindow.getAllWindows())if(win.webContents!==sender)win.webContents.send('data',store.data);}
function trusted(event) {if(!BrowserWindow.fromWebContents(event.sender) || event.senderFrame!==event.sender.mainFrame)throw new Error('非法请求');}
ipcMain.handle('load',e=>{trusted(e);return {data:store.data,dataDir:store.dir};});
ipcMain.handle('change',(e,action)=>{trusted(e);const data=store.change(action);broadcast(e.sender);return data;});
ipcMain.handle('float',(e,id)=>{trusted(e);const n=store.data.notes.find(n=>n.id===id&&!n.deletedAt);if(!n)return;const existing=floats.get(id);if(existing){existing.show();existing.focus();}else floats.set(id,createWindow(id));});
ipcMain.handle('window',(e,action)=>{trusted(e);const w=BrowserWindow.fromWebContents(e.sender);if(action==='minimize')w.minimize();if(action==='maximize')w.isMaximized()?w.unmaximize():w.maximize();if(action==='close')w.close();if(action==='top'){w.setAlwaysOnTop(!w.isAlwaysOnTop());return w.isAlwaysOnTop();}});
ipcMain.on('ready-close',e=>{trusted(e);const w=BrowserWindow.fromWebContents(e.sender);if(quitting || testMode || w!==mainWindow){w._allowClose=true;w.close();}else w.hide();});
ipcMain.handle('open-data',e=>{trusted(e);return shell.openPath(store.dir);});
ipcMain.handle('export-backup',async e=>{trusted(e);const r=await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender),{defaultPath:`拾光便签备份-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'便签备份',extensions:['json']}]});if(r.canceled)return false;fs.writeFileSync(r.filePath,JSON.stringify(store.data,null,2),'utf8');return true;});
ipcMain.handle('import-backup',async e=>{trusted(e);const r=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{properties:['openFile'],filters:[{name:'拾光便签备份',extensions:['json']}]});if(r.canceled)return null;const size=fs.statSync(r.filePaths[0]).size;if(size>250*1024*1024)throw new Error('备份超过 250 MB，请拆分后导入');const incoming=JSON.parse(fs.readFileSync(r.filePaths[0],'utf8'));const data=store.merge(incoming);broadcast(e.sender);return data;});
ipcMain.handle('export-note',async(e,id,format)=>{trusted(e);const n=store.data.notes.find(x=>x.id===id);if(!n)return false;const ext=format==='html'?'html':'txt';const name=(n.title||'未命名便签').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80);const r=await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender),{defaultPath:name+'.'+ext,filters:[{name:ext==='html'?'图文网页':'纯文本',extensions:[ext]}]});if(r.canceled)return false;const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const content=ext==='txt'?'\uFEFF'+n.title+'\n\n'+n.text:`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escape(n.title)}</title><style>body{max-width:800px;margin:60px auto;padding:24px;font:16px/1.9 system-ui}img{max-width:100%}blockquote{border-left:3px solid #8ba58d;padding-left:20px;color:#667}</style><h1>${escape(n.title)}</h1>${n.html}`;fs.writeFileSync(r.filePath,content,'utf8');return true;});
app.on('before-quit',()=>{quitting=true;});
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>{if(quitting||testMode)app.quit();});

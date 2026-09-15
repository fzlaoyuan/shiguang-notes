const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('notesAPI',{
  load:()=>ipcRenderer.invoke('load'),
  change:action=>ipcRenderer.invoke('change',action),
  exportBackup:()=>ipcRenderer.invoke('export-backup'),
  importBackup:()=>ipcRenderer.invoke('import-backup'),
  exportNote:(id,format)=>ipcRenderer.invoke('export-note',id,format),
  openData:()=>ipcRenderer.invoke('open-data'),
  float:id=>ipcRenderer.invoke('float',id),
  window:action=>ipcRenderer.invoke('window',action),
  readyClose:()=>ipcRenderer.send('ready-close'),
  onFlush:fn=>{ipcRenderer.on('flush',fn);},
  onData:fn=>{ipcRenderer.on('data',(_,data)=>fn(data));},
  onNew:fn=>{ipcRenderer.on('new-note',fn);}
});

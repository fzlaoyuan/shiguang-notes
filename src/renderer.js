import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import {createIcons,icons} from 'lucide';
import {EditorState} from '@tiptap/pm/state';

const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<i data-lucide="${n}"></i>`;
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.6}});
const api=window.notesAPI;const floatingId=new URLSearchParams(location.search).get('note');
const colors={sage:'#8fa984',sand:'#c9ad76',rose:'#c99599',sky:'#87a9bd',lavender:'#aa99be'};
let data,dataDir,selectedId=floatingId,view='all',query='',sort='updated',day='',month=new Date(),dirty=false,timer,toastTimer,savePromise=Promise.resolve(),revision=0;
let rendering=false,pendingImages=Promise.resolve();
let appVersion='',searchScope='all',draggingNoteId=null,secureBusy=false;
document.body.classList.toggle('floating',!!floatingId);
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function error(e){console.error(e);toast('操作失败：'+e.message);}
function active(){return data?.notes.find(n=>n.id===selectedId);}
function locked(n=active()){return !!n?.locked&&!n.unlocked;}
function terms(){return query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);}
function highlight(text){
  const words=terms();let rest=String(text),out='';
  while(rest){let at=-1,length=0;for(const word of words){const pos=rest.toLowerCase().indexOf(word);if(pos>=0&&(at<0||pos<at||(pos===at&&word.length>length))){at=pos;length=word.length;}}
    if(at<0){out+=esc(rest);break;}out+=esc(rest.slice(0,at))+'<mark>'+esc(rest.slice(at,at+length))+'</mark>';rest=rest.slice(at+length);
  }return out;
}
function dateKey(date){const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function dateLabel(value){const date=new Date(value);return date.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}).replace('/','月')+'日';}
function safeHtml(html){const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form,video,audio,svg,math').forEach(n=>n.remove());for(const e of doc.body.querySelectorAll('*')){for(const a of [...e.attributes])if(a.name.startsWith('on')||['style','srcset','id','class'].includes(a.name))e.removeAttribute(a.name);if(e.tagName==='IMG'&&!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(e.getAttribute('src')||''))e.remove();if(e.tagName==='A')e.removeAttribute('href');}return doc.body.innerHTML;}
const editor=new Editor({
  element:$('#editor'),extensions:[StarterKit.configure({link:{openOnClick:false}}),Image.configure({allowBase64:true}),Placeholder.configure({placeholder:'此刻，你想记下什么？\n输入文字，或粘贴一张图片…'}),TaskList,TaskItem.configure({nested:true}),Highlight],
  content:'<p></p>',
  editorProps:{attributes:{'aria-label':'便签正文',role:'textbox','aria-multiline':'true'},transformPastedHTML:safeHtml,
    handlePaste:(_view,event)=>{const files=[...(event.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));if(files.length){event.preventDefault();queueImages(files);return true;}return false;},
    handleDrop:(_view,event)=>{const files=[...(event.dataTransfer?.files||[])].filter(f=>f.type.startsWith('image/'));if(files.length){event.preventDefault();const pos=_view.posAtCoords({left:event.clientX,top:event.clientY});if(pos)editor.commands.setTextSelection(pos.pos);queueImages(files);return true;}return false;}
  },onUpdate:()=>{if(!rendering)markDirty();updateStats();},onSelectionUpdate:()=>updateToolbar(),onTransaction:()=>updateToolbar()
});
function updateStats(){$('#word-count').textContent=editor.getText().replace(/\s/g,'').length+' 字';$('#image-count').textContent=editor.view.dom.querySelectorAll('img').length+' 张图片';}
function updateToolbar(){if(!editor)return;$$('[data-command]').forEach(b=>{const cmd=b.dataset.command;b.classList.toggle('active',cmd==='heading'?editor.isActive('heading',{level:2}):editor.isActive(cmd));});}
function markDirty(){if(!active()||active().deletedAt||locked()||secureBusy)return;dirty=true;revision++;$('#save-status').textContent='正在保存…';clearTimeout(timer);timer=setTimeout(()=>flush().catch(error),400);}
async function flush(){clearTimeout(timer);if(!dirty)return savePromise;const n=active();if(!n)return savePromise;const noteId=n.id;const rev=revision;const patch={title:$('#note-title').value,html:editor.getHTML(),text:editor.getText()};Object.assign(n,patch);dirty=false;
  const task=savePromise.catch(()=>{}).then(()=>api.change({type:'update',id:noteId,patch}));savePromise=task;
  try{const fresh=await task;data=fresh;if(selectedId===noteId&&revision===rev){$('#save-status').innerHTML=icon('check')+' 已保存到本机';renderLists();refreshIcons();}}catch(e){if(selectedId===noteId){dirty=true;$('#save-status').textContent='保存失败，请重试';}throw e;}
}
async function change(action){await pendingImages;await flush();data=await api.change(action);renderLists();return data;}
function visibleNotes(){const words=terms(),global=words.length&&searchScope==='all';return data.notes.filter(n=>{
 if(view==='trash'?!n.deletedAt:!!n.deletedAt)return false;
 if(!global){if(view==='pinned'&&!n.pinned)return false;if(view.startsWith('folder:')&&n.folderId!==view.slice(7))return false;if(view==='calendar'&&day&&dateKey(n.updatedAt)!==day)return false;}
 const text=(n.title+' '+(n.locked?'':n.text)).normalize('NFKC').toLowerCase();return words.every(w=>text.includes(w));
}).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(sort==='title'?(a.title||'无标题').localeCompare(b.title||'无标题','zh-CN'):Date.parse(b[sort==='created'?'createdAt':'updatedAt'])-Date.parse(a[sort==='created'?'createdAt':'updatedAt'])));}
function viewTitle(){return {all:'全部便签',pinned:'置顶便签',calendar:'日历视图',trash:'回收站'}[view]||data.folders.find(f=>f.id===view.slice(7))?.name||'全部便签';}
function renderLists(){
 document.body.classList.toggle('dark',data.settings?.theme==='dark');
 $('#all-count').textContent=data.notes.filter(n=>!n.deletedAt).length;$('#pin-count').textContent=data.notes.filter(n=>n.pinned&&!n.deletedAt).length;$('#trash-count').textContent=data.notes.filter(n=>n.deletedAt).length;
 $('#folders').innerHTML=data.folders.map(f=>'<div class="folder-row" data-drop-folder="'+esc(f.id)+'"><button class="nav-item '+(view==='folder:'+f.id?'active':'')+'" data-view="folder:'+esc(f.id)+'">'+icon('folder')+'<span>'+esc(f.name)+'</span><small>'+ (data.notes.filter(n=>n.folderId===f.id&&!n.deletedAt).length||'')+'</small></button><button class="folder-more" data-folder-menu="'+esc(f.id)+'" title="管理分组">'+icon('ellipsis')+'</button></div>').join('');
 $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 $('#view-title').textContent=terms().length?'搜索结果':viewTitle();const notes=visibleNotes();$('#list-count').textContent='共 '+notes.length+' 篇记录';$('#sort-label').textContent={updated:'最近编辑',created:'最近创建',title:'标题排序'}[sort];$('#clear-search').hidden=!query;
 $('#note-list').innerHTML=notes.length?notes.map(n=>{
  const image=!n.locked&&n.html.match(/<img[^>]+src="(data:image\/(?:png|jpeg|gif|webp);base64,[^"]+)"/i)?.[1];
  const index=terms().length?n.text.normalize('NFKC').toLowerCase().indexOf(terms()[0]):-1;
  const preview=n.locked?'正文与图片已加密，输入密码打开':n.text.slice(Math.max(0,index-30),Math.max(0,index-30)+130)||'等待一段新的灵感…';
  return '<button class="note-card '+(selectedId===n.id?'active':'')+'" data-note="'+esc(n.id)+'" draggable="'+!n.deletedAt+'"><div class="card-title">'+(n.locked?icon('lock-keyhole'):'')+(n.pinned?icon('pin'):'')+'<span>'+highlight(n.title||'无标题便签')+'</span></div>'+(image?'<img class="card-thumb" draggable="false" src="'+esc(image)+'" alt="便签图片">':'')+'<div class="card-preview">'+(n.locked?esc(preview):highlight(preview))+'</div><div class="card-bottom"><span>'+dateLabel(n.updatedAt)+'</span><span class="card-tag">'+esc(data.folders.find(f=>f.id===n.folderId)?.name||'')+'</span></div></button>';
 }).join(''):'<div class="empty-list">'+icon(query?'search':'notebook')+'<div>'+(query?'没有找到相关便签':view==='trash'?'回收站是空的':'这里还没有便签')+'</div><small>'+(query?'试试其他关键词':'点击“新建便签”开始记录')+'</small></div>';
 $('#calendar').hidden=view!=='calendar'||!!terms().length;if(view==='calendar')renderCalendar();refreshIcons();
}
function renderDocument(){const n=active(),hidden=locked(n);rendering=true;
 $('#document').hidden=!n||hidden;$('#empty-editor').hidden=!!n;$('#locked-editor').hidden=!n||!hidden;$('#locked-title').textContent=n?.title||'加锁便签';$('#toolbar').style.visibility=n&&!hidden?'visible':'hidden';$('#trash-banner').hidden=!n?.deletedAt;
 $$('.note-actions button').forEach(b=>b.disabled=!n||!!n.deletedAt||secureBusy);
 $('#lock-note').innerHTML=icon(hidden?'lock-keyhole':n?.locked?'lock-keyhole-open':'lock-keyhole');$('#lock-note').title=hidden?'输入密码打开':n?.locked?'便签锁：立即锁定 / 移除密码':'设置便签密码';
 if(n){$('#note-title').value=n.title;$('#note-title').readOnly=!!n.deletedAt||hidden||secureBusy;editor.setEditable(!n.deletedAt&&!hidden&&!secureBusy);editor.commands.setContent(safeHtml(hidden?'':n.html),{emitUpdate:false});$('#breadcrumb').textContent=data.folders.find(f=>f.id===n.folderId)?.name||'';$('#note-date').textContent=new Date(n.updatedAt).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});$('#created-date').textContent='创建于 '+new Date(n.createdAt).toLocaleDateString('zh-CN');$('#note-folder').innerHTML=data.folders.map(f=>'<option value="'+esc(f.id)+'" '+(n.folderId===f.id?'selected':'')+'>'+esc(f.name)+'</option>').join('');$('#note-folder').disabled=!!n.deletedAt||secureBusy;$('#pin-note').classList.toggle('active',n.pinned);$('#pin-note').title=n.pinned?'取消置顶':'置顶便签';$('#note-color-dot').style.background=colors[n.color]||colors.sage;$('#save-status').innerHTML=icon(hidden?'lock-keyhole':'check')+(hidden?' 正文已加密':' 已保存到本机');}else{editor.setEditable(false);editor.commands.setContent('<p></p>',{emitUpdate:false});$('#breadcrumb').textContent=viewTitle();$('#save-status').textContent='';}
 // Clear history so another note cannot recover a previously displayed secret.
 editor.view.updateState(EditorState.create({doc:editor.state.doc,schema:editor.schema,plugins:editor.state.plugins}));
 rendering=false;updateStats();refreshIcons();
}
async function leaveNote(nextId){if(nextId!==selectedId&&active()?.locked&&active().unlocked)data=await api.relock(selectedId);}
async function reconcileSelection(){const notes=visibleNotes();if(!notes.some(n=>n.id===selectedId)){await leaveNote(notes[0]?.id);selectedId=notes[0]?.id;}renderLists();renderDocument();}
async function selectNote(id){if(secureBusy)return;await pendingImages;await flush();await leaveNote(id);selectedId=id;renderLists();renderDocument();$('#document-scroll').scrollTop=0;}
async function setView(v){if(secureBusy)return;await pendingImages;await flush();await leaveNote(undefined);view=v;day='';await reconcileSelection();}
async function newNote(){if(secureBusy)return;if(floatingId){toast('请在主窗口新建便签');return;}await pendingImages;await flush();await leaveNote(undefined);await change({type:'create',folderId:view.startsWith('folder:')?view.slice(7):data.folders[0].id});if(['trash','pinned','calendar'].includes(view))view='all';query='';$('#search').value='';selectedId=data.notes[0].id;renderLists();renderDocument();$('#note-title').focus();}
async function queueImages(files){const target=selectedId;const position=editor.state.selection.from;pendingImages=pendingImages.catch(()=>{}).then(async()=>{if(!active()||active().deletedAt||locked()||secureBusy)return;const images=[];for(const file of files){if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)){toast('支持 PNG、JPG、GIF 和 WebP 图片');continue;}if(file.size>15*1024*1024){toast('单张图片不能超过 15 MB');continue;}const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('图片读取失败'));r.readAsDataURL(file);});images.push({type:'image',attrs:{src,alt:file.name||'粘贴的图片'}});}if(target===selectedId&&images.length)editor.chain().focus().insertContentAt(Math.min(position,editor.state.doc.content.size),[...images,{type:'paragraph'}]).run();});pendingImages.catch(error);return pendingImages;}
function showPopup(anchor,html){const p=$('#popup');p.innerHTML=html;p.hidden=false;refreshIcons();const rect=anchor.getBoundingClientRect();p.style.left=Math.max(8,Math.min(rect.left,innerWidth-p.offsetWidth-12))+'px';p.style.top=Math.max(56,Math.min(rect.bottom+6,innerHeight-p.offsetHeight-12))+'px';}
function menuButton(action,label,i,danger=false){return `<button data-menu-action="${action}" class="${danger?'danger':''}">${icon(i)}${label}</button>`;}
function modal(title,body,footer,onSubmit){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-footer').innerHTML=footer||'';$('#dialog-form').onsubmit=async e=>{e.preventDefault();try{await onSubmit?.();}catch(e){error(e);}};$('#dialog').showModal();refreshIcons();}
function closeModal(){$('#dialog').close();}
function noteMenu(anchor){
  const n=active();if(!n)return;
  if(n.deletedAt){showPopup(anchor,menuButton('restore','恢复便签','archive-restore')+menuButton('delete','永久删除','trash-2',true));return;}
  let html='<div class="colors">'+Object.entries(colors).map(([key,color])=>'<button title="'+({sage:'鼠尾草',sand:'暖沙',rose:'蔷薇',sky:'天空',lavender:'薰衣草'}[key])+'" data-color="'+key+'" class="'+(n.color===key?'selected':'')+'" style="background:'+color+'"></button>').join('')+'</div>'+menuButton('move','移动到分组…','folder-input')+menuButton('toggle-pin',n.pinned?'取消置顶':'置顶便签','pin');
  if(!n.locked)html+=menuButton('lock','设置便签密码…','lock-keyhole');
  else{html+=menuButton(locked(n)?'unlock':'lock-now',locked(n)?'输入密码打开…':'立即锁定','lock-keyhole');html+=menuButton('remove-lock','移除密码…','key-round');}
  html+=menuButton('duplicate','创建副本','files');
  if(!locked(n))html+='<div class="popup-divider"></div>'+menuButton('copy','复制全部文字','copy')+menuButton('txt',n.locked?'导出明文 TXT':'导出为 TXT','file-text')+menuButton('html',n.locked?'导出明文 HTML':'导出图文 HTML','file-code-2');
  html+='<div class="popup-divider"></div>'+menuButton('trash','删除（移入回收站）','trash-2',true);
  showPopup(anchor,html);
}
async function moveNote(id,folderId){
  if(secureBusy)return;if(!data.folders.some(f=>f.id===folderId))throw new Error('目标分组不存在');
  const n=data.notes.find(n=>n.id===id&&!n.deletedAt);if(!n)throw new Error('便签不存在');
  if(n.folderId===folderId)return;
  await change({type:'move',id,folderId});await reconcileSelection();toast('已移动到“'+data.folders.find(f=>f.id===folderId).name+'”');
}
function moveDialog(id){
  const n=data.notes.find(n=>n.id===id);if(!n)return;
  modal('移动到分组','<p>将“'+esc(n.title||'无标题便签')+'”移入：</p><select class="text-input" id="move-folder" aria-label="目标分组">'+data.folders.map(f=>'<option value="'+esc(f.id)+'" '+(f.id===n.folderId?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select>','<button type="button" data-dismiss>取消</button><button class="primary" type="submit">移动便签</button>',async()=>{await moveNote(id,$('#move-folder').value);closeModal();});
}
function passwordDialog(title,id,mode){
  const setting=mode==='set';
  const tip=setting?'正文和图片将加密保存，标题仍可见。密码无法找回，请牢记。加锁前已有的备份和导出文件不会自动加密。':mode==='remove'?'输入当前密码，移除后正文将恢复为普通本地保存。':'输入这篇便签的密码，切换便签或关闭窗口后自动锁定。';
  modal(title,'<p class="password-hint">'+tip+'</p><label class="password-label" for="note-password">'+(setting?'设置密码':'便签密码')+'</label><input id="note-password" class="text-input" type="password" autocomplete="'+(setting?'new-password':'current-password')+'" minlength="6" maxlength="128" required placeholder="至少 6 个字符">'+(setting?'<label class="password-label" for="confirm-password">再次输入密码</label><input id="confirm-password" class="text-input" type="password" autocomplete="new-password" minlength="6" maxlength="128" required placeholder="请再次输入密码">':'')+'<p id="password-error" role="alert" hidden></p>','<button type="button" data-dismiss>取消</button><button class="primary" type="submit">'+(setting?'设置密码':mode==='remove'?'移除密码':'打开便签')+'</button>',async()=>{
    const password=$('#note-password').value,submit=$('#dialog-footer button[type=submit]');
    if(setting&&password!==$('#confirm-password').value){$('#password-error').textContent='两次输入的密码不一致';$('#password-error').hidden=false;return;}
    submit.disabled=true;$('#password-error').hidden=true;
    try{await pendingImages;await flush();data=await (setting?api.setLock(id,password):mode==='remove'?api.removeLock(id,password):api.unlock(id,password));closeModal();renderLists();renderDocument();toast(setting?'已设置密码并锁定':mode==='remove'?'已移除便签密码':'便签已打开');}
    catch(e){$('#password-error').textContent=e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,'');$('#password-error').hidden=false;$('#note-password').focus();}
    finally{submit.disabled=false;}
  });
  $('#note-password').focus();
}
function lockDialog(id){const n=data.notes.find(n=>n.id===id);if(!n)return;if(!n.locked)passwordDialog('设置便签密码',id,'set');else if(locked(n))passwordDialog('输入密码打开',id,'unlock');else showPopup($('#lock-note'),menuButton('lock-now','立即锁定','lock-keyhole')+menuButton('remove-lock','移除密码…','key-round'));}
$('#lock-note').onclick=()=>lockDialog(selectedId);$('#unlock-note').onclick=()=>passwordDialog('输入密码打开',selectedId,'unlock');$('#move-note').onclick=()=>moveDialog(selectedId);
$('#note-list').addEventListener('contextmenu',async event=>{const card=event.target.closest('[data-note]');if(!card)return;event.preventDefault();const point={left:event.clientX||card.getBoundingClientRect().left,bottom:event.clientY||card.getBoundingClientRect().bottom};try{await selectNote(card.dataset.note);noteMenu({getBoundingClientRect:()=>point});}catch(e){error(e);}});
$('#note-list').addEventListener('keydown',event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){const card=event.target.closest('[data-note]');if(card){event.preventDefault();selectNote(card.dataset.note).then(()=>noteMenu(card)).catch(error);}}});
document.addEventListener('dragstart',event=>{const card=event.target.closest('.note-card[draggable=true]');if(!card||secureBusy)return;draggingNoteId=card.dataset.note;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-shiguang-note',draggingNoteId);card.classList.add('dragging');});
document.addEventListener('dragover',event=>{const target=event.target.closest('[data-drop-folder]');if(!target||!draggingNoteId)return;event.preventDefault();event.dataTransfer.dropEffect='move';$$('.drop-target').forEach(el=>{if(el!==target)el.classList.remove('drop-target');});target.classList.add('drop-target');});
document.addEventListener('dragleave',event=>{const target=event.target.closest('[data-drop-folder]');if(target&&!target.contains(event.relatedTarget))target.classList.remove('drop-target');});
document.addEventListener('drop',event=>{const target=event.target.closest('[data-drop-folder]'),id=draggingNoteId;if(!target||!id)return;event.preventDefault();target.classList.remove('drop-target');draggingNoteId=null;moveNote(id,target.dataset.dropFolder).catch(error);});
document.addEventListener('dragend',()=>{draggingNoteId=null;$$('.dragging,.drop-target').forEach(el=>el.classList.remove('dragging','drop-target'));});
function folderDialog(id){const f=data.folders.find(f=>f.id===id);modal(f?'重命名分组':'新建分组',`<input class="text-input" id="folder-name" maxlength="80" placeholder="例如：舞蹈舞美、AI 绘图提示词" value="${esc(f?.name||'')}" required>`,`<button type="button" data-dismiss>取消</button><button class="primary" type="submit">保存分组</button>`,async()=>{const name=$('#folder-name').value.trim();if(!name)return;if(data.folders.some(x=>x.name===name&&x.id!==id)){toast('已存在同名分组');return;}await change({type:f?'folder-rename':'folder-add',id,name});closeModal();if(!f)await setView('folder:'+data.folders.at(-1).id);else renderDocument();});setTimeout(()=>{$('#folder-name').focus();$('#folder-name').select();},30);}
function confirmModal(title,message,run){modal(title,`<p>${esc(message)}</p>`,`<button type="button" data-dismiss>取消</button><button type="submit" class="primary">确认</button>`,async()=>{await run();closeModal();});}
function settings(){modal('设置与备份',`<div class="settings-row"><div><h3>外观</h3><p>切换浅色或深色界面</p></div><button type="button" data-setting="theme">${data.settings?.theme==='dark'?'切换浅色':'切换深色'}</button></div><div class="settings-row"><div><h3>导出完整备份</h3><p>包含全部分组、便签、图片和回收站</p></div><button type="button" data-setting="export">导出备份</button></div><div class="settings-row"><div><h3>导入备份</h3><p>追加为新便签，保留当前所有内容</p></div><button type="button" data-setting="import">导入备份</button></div><div class="settings-row"><div><h3>本地数据与自动备份</h3><p>每 15 分钟有修改时备份，保留最近 30 份</p></div><button type="button" data-setting="path">打开目录</button></div><div class="data-path">${esc(dataDir)}</div><div class="settings-row"><div><h3>快捷键</h3><p>Ctrl N 新建 · Ctrl K 搜索 · Ctrl S 保存<br>Ctrl Alt N 全局新建 · Esc 退出专注模式<br>关闭主窗口后保留在系统托盘，右键托盘可退出。</p></div></div><p class="settings-version">拾光便签 ${esc(appVersion)} · 免费软件，禁止商业用途</p>`);}
function renderCalendar(){const year=month.getFullYear(),m=month.getMonth();const first=(new Date(year,m,1).getDay()+6)%7;const count=new Date(year,m+1,0).getDate();const days=new Set(data.notes.filter(n=>!n.deletedAt).map(n=>dateKey(n.updatedAt)));$('#calendar').innerHTML=`<div class="calendar-head"><button data-month="-1" title="上个月">${icon('chevron-left')}</button><span>${year} 年 ${m+1} 月</span><button data-month="1" title="下个月">${icon('chevron-right')}</button></div><div class="calendar-grid">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({length:count},(_,i)=>{const key=dateKey(new Date(year,m,i+1));return `<button data-day="${key}" class="${day===key?'selected ':''}${days.has(key)?'has-notes':''}">${i+1}</button>`;}).join('')}</div><button class="clear-date" data-clear-day>显示全部日期 · 按最近编辑日期筛选</button>`;}
document.addEventListener('click',async event=>{const eventPath=event.composedPath();const b=eventPath.find(el=>el.tagName==='BUTTON');try{
  if(!eventPath.some(el=>el.id==='popup'||el.id==='note-menu'||el.id==='lock-note'||el.dataset?.folderMenu))$('#popup').hidden=true;
  const contact=eventPath.find(el=>el.dataset?.contact);
  if(contact){event.preventDefault();await api.openContact(contact.dataset.contact);return;}
  if(!b)return;
  if(b.dataset.window)await api.window(b.dataset.window);
  if(b.dataset.view)await setView(b.dataset.view);
  if(b.dataset.note)await selectNote(b.dataset.note);
  if(b.dataset.folderMenu){const id=b.dataset.folderMenu;showPopup(b,menuButton('rename:'+id,'重命名分组','pencil')+menuButton('remove-folder:'+id,'删除分组','folder-minus',true));}
  if(b.dataset.command){if(!active()||active().deletedAt||locked()||secureBusy)return;const c=editor.chain().focus();const name=b.dataset.command;const command={undo:()=>c.undo(),redo:()=>c.redo(),heading:()=>c.toggleHeading({level:2}),bold:()=>c.toggleBold(),italic:()=>c.toggleItalic(),underline:()=>c.toggleUnderline(),strike:()=>c.toggleStrike(),highlight:()=>c.toggleHighlight(),taskList:()=>c.toggleTaskList(),bulletList:()=>c.toggleBulletList(),orderedList:()=>c.toggleOrderedList(),blockquote:()=>c.toggleBlockquote(),codeBlock:()=>c.toggleCodeBlock(),horizontalRule:()=>c.setHorizontalRule()}[name];command?.().run();updateToolbar();}
  if(b.hasAttribute('data-dismiss'))closeModal();
  if(b.dataset.month){month=new Date(month.getFullYear(),month.getMonth()+Number(b.dataset.month),1);renderCalendar();refreshIcons();}
  if(b.dataset.day||b.hasAttribute('data-clear-day')){await flush();day=b.dataset.day||'';await reconcileSelection();}
  if(b.dataset.color){await change({type:'update',id:selectedId,patch:{color:b.dataset.color}});renderDocument();$('#popup').hidden=true;}
  if(b.dataset.menuAction){const a=b.dataset.menuAction;$('#popup').hidden=true;if(a.startsWith('rename:'))folderDialog(a.slice(7));if(a.startsWith('remove-folder:')){const id=a.slice(14);if(data.folders.length<2){toast('至少保留一个分组');return;}confirmModal('删除分组','分组内的便签会移入其他分组，内容会保留。',async()=>{await change({type:'folder-delete',id});await setView('all');});}if(a==='move')moveDialog(selectedId);if(a==='lock')lockDialog(selectedId);if(a==='lock-now'){await pendingImages;await flush();data=await api.lockNow(selectedId);renderLists();renderDocument();}if(a==='remove-lock')passwordDialog('移除便签密码',selectedId,'remove');if(a==='unlock')passwordDialog('输入密码打开',selectedId,'unlock');if(a==='toggle-pin'){await change({type:'update',id:selectedId,patch:{pinned:!active().pinned}});renderDocument();}if(a==='restore'){await change({type:'restore',id:selectedId});await reconcileSelection();}if(a==='delete')$('#delete-note').click();if(a==='trash'){await change({type:'trash',id:selectedId});await reconcileSelection();toast('已移入回收站，可随时恢复');}if(a==='txt'||a==='html'){if(locked())throw new Error('请先输入密码解锁便签');await flush();if(await api.exportNote(selectedId,a))toast('便签已导出');}if(a==='copy'){if(locked())throw new Error('请先输入密码解锁便签');await navigator.clipboard.writeText($('#note-title').value+'\n\n'+editor.getText());toast('已复制便签文字');}if(a==='duplicate'){await change({type:'duplicate',id:selectedId});await selectNote(data.notes[0].id);}}
  if(b.dataset.setting){const a=b.dataset.setting;if(a==='theme'){await change({type:'settings',patch:{theme:data.settings?.theme==='dark'?'light':'dark'}});b.textContent=data.settings.theme==='dark'?'切换浅色':'切换深色';}if(a==='path')await api.openData();if(a==='export'){await flush();if(await api.exportBackup())toast('完整备份已导出');}if(a==='import'){await flush();const result=await api.importBackup();if(result){data=result;renderLists();renderDocument();toast('备份已导入，现有内容已保留');}}}
}catch(e){error(e);}});
$('#toolbar').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault();});
$('#note-title').addEventListener('input',markDirty);
async function searchChanged(){try{await pendingImages;await flush();query=$('#search').value;await reconcileSelection();}catch(e){error(e);}}
$('#search').addEventListener('input',searchChanged);
$('#search-scope').onchange=()=>{searchScope=$('#search-scope').value;searchChanged();};
$('#clear-search').onclick=()=>{$('#search').value='';searchChanged();$('#search').focus();};
$('#note-folder').addEventListener('change',()=>moveNote(selectedId,$('#note-folder').value).catch(error));
$('#new-note').onclick=()=>newNote().catch(error);$('#empty-create').onclick=()=>newNote().catch(error);$('#add-folder').onclick=()=>folderDialog();
$('#pin-note').onclick=async()=>{try{await change({type:'update',id:selectedId,patch:{pinned:!active().pinned}});renderDocument();}catch(e){error(e);}};
$('#float-note').onclick=async()=>{try{await flush();await api.float(selectedId);}catch(e){error(e);}};
$('#sort-button').onclick=()=>{sort=sort==='updated'?'created':sort==='created'?'title':'updated';renderLists();};
$('#focus-mode').onclick=()=>document.body.classList.toggle('focus');
$('#note-menu').onclick=e=>{if(active())noteMenu(e.currentTarget);};
$('#restore-note').onclick=async()=>{try{await change({type:'restore',id:selectedId});selectedId=visibleNotes()[0]?.id;renderLists();renderDocument();toast('便签已恢复');}catch(e){error(e);}};
$('#delete-note').onclick=()=>confirmModal('永久删除便签','删除后无法在回收站中恢复。确定删除这篇便签？',async()=>{await change({type:'delete',id:selectedId});selectedId=visibleNotes()[0]?.id;renderLists();renderDocument();});
$('#add-image').onclick=()=>{if(active()&&!active().deletedAt&&!locked()&&!secureBusy)$('#image-input').click();};$('#image-input').onchange=e=>{queueImages([...e.target.files]);e.target.value='';};
$('#settings-button').onclick=settings;$('#dialog-close').onclick=closeModal;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('focus');$('#popup').hidden=true;}if((e.ctrlKey||e.metaKey)&&!$('#dialog').open){if(e.key.toLowerCase()==='s'){e.preventDefault();flush().then(()=>toast('已保存到本机')).catch(error);}if(e.key.toLowerCase()==='n'){e.preventDefault();newNote().catch(error);}if(e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus();$('#search').select();}}});
api.onNew(()=>newNote().catch(error));
api.onFlush(async()=>{try{await pendingImages;await flush();api.readyClose();}catch(e){error(new Error('尚未保存，窗口保持打开。'+e.message));}});
api.onData(async()=>{try{await pendingImages;await flush();const old=active();const latest=await api.load();data=latest.data;if(!floatingId&&!data.notes.some(n=>n.id===selectedId))selectedId=visibleNotes()[0]?.id;renderLists();const next=active();if(!dirty&&(!old||!next||old.html!==next.html||old.title!==next.title||old.deletedAt!==next.deletedAt||old.folderId!==next.folderId||old.pinned!==next.pinned||old.locked!==next.locked||old.unlocked!==next.unlocked))renderDocument();}catch(e){error(e);}});
api.onBeforeLock(async(id,token)=>{try{if(id===selectedId){await pendingImages;secureBusy=true;editor.setEditable(false);$('#note-title').readOnly=true;await flush();}api.lockReady(token);}catch(e){api.lockReady(token,e.message);}});
api.onLockFinished(async()=>{if(!secureBusy)return;try{secureBusy=false;const latest=await api.load();data=latest.data;renderLists();renderDocument();}catch(e){error(e);}});
async function init(){try{const result=await api.load();data=result.data;dataDir=result.dataDir;appVersion=result.version;selectedId=floatingId||visibleNotes()[0]?.id;renderLists();renderDocument();}catch(e){toast('读取失败：'+e.message);}}
init();

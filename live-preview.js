import {StateEffect, StateField} from '@codemirror/state';
import {Decoration, EditorView, ViewPlugin, WidgetType} from '@codemirror/view';
import {editorInfoField, editorLivePreviewField} from 'obsidian';

export const liveResult = StateEffect.define();
export const liveRefresh = StateEffect.define();

// Only replace complete, non-overlapping blocks. The caret/selection always keeps its source.
export function visibleBlocks(blocks, selections, length) {
 let end = -1;
 return blocks.filter(block => {
  if (!Number.isInteger(block.from) || !Number.isInteger(block.to) || block.from < 0 || block.to > length || block.from >= block.to || block.from < end) return false;
  end = block.to;
  return !selections.some(range => range.from <= block.to && range.to >= block.from);
 });
}

// Block replacements must cover whole lines without hiding unmapped source.
export function lineBlocks(blocks,doc){
 const valid=blocks.filter(block=>Number.isInteger(block.from)&&Number.isInteger(block.to)&&block.from>=0&&block.to<=doc.length&&block.from<block.to).sort((a,b)=>a.from-b.from);
 const groups=[];
 for(const block of valid){
  const from=doc.lineAt(block.from).from,to=doc.lineAt(block.to-1).to,last=groups.at(-1);
  if(last&&from<=last.to){last.to=Math.max(last.to,to);last.blocks.push(block);}
  else groups.push({from,to,blocks:[block]});
 }
 return groups.flatMap(group=>{
  let end=group.from;
  for(const block of group.blocks){
   if(block.from<end||doc.sliceString(end,block.from).trim())return [];
   end=block.to;
  }
  if(doc.sliceString(end,group.to).trim())return [];
  return [{from:group.from,to:group.to,html:group.blocks.map(block=>block.html).join('')}];
 });
}
// Live blocks share the editor surface; the full-page preview keeps its own theme.
export function liveShell(doc, hostDocument) {
 const body=hostDocument?.body, styles=body?hostDocument.defaultView.getComputedStyle(body):null;
 const dark=body?body.classList.contains('theme-dark'):doc.documentElement.classList.contains('dark');
 const value=(key,fallback)=>styles?.getPropertyValue(key).trim()||fallback;
 const background=value('--background-primary',dark?'#1e1e1e':'#ffffff');
 const foreground=value('--text-normal',dark?'#dadada':'#222222');
 const size=value('--font-text-size','16px');
 const overrides=`html,body{margin:0;min-height:0;overflow:hidden;background:var(--card-bg)}html{--card-bg:${background}!important;--tw-prose-body:${foreground}!important;--tw-prose-headings:${foreground}!important}body{color:var(--tw-prose-body)}#post-container{padding:0;max-width:none}#post-container .custom-md{max-width:none!important;font-size:${size};line-height:1.7}#post-container .custom-md>:first-child{margin-top:0!important}#post-container .custom-md>:last-child{margin-bottom:0!important}`;
 return {before:`<!doctype html><html class="${dark?'dark':''}" data-yellow="${doc.documentElement.dataset.yellow}">${doc.head.outerHTML}<body><style>${overrides.replace(/<\/style/gi,'<\\/style')}</style><article id="post-container"><div class="custom-md">`,after:`</div></article>${[...doc.body.querySelectorAll('script')].map(el=>el.outerHTML).join('')}`};
}

class BlogBlock extends WidgetType {
 constructor(block, shell) { super(); this.block = block; this.shell = shell; }
 eq(other) { return this.block.from === other.block.from && this.block.to === other.block.to && this.block.html === other.block.html && this.shell.before === other.shell.before && this.shell.after === other.shell.after; }
 toDOM(view) {
  const doc = view.dom.ownerDocument;
  const host = doc.createElement('div'); host.className = 'tonks-live-block';
  const edit = doc.createElement('button'); edit.className = 'tonks-live-edit'; edit.textContent = '编辑此块';
  const open = () => { view.dispatch({selection:{anchor:this.block.from},scrollIntoView:true}); view.focus(); };
  edit.onclick = open; host.append(edit);
  const frame = doc.createElement('iframe'); frame.className = 'tonks-live-frame'; frame.title = '博客实时预览块'; frame.setAttribute('sandbox', 'allow-scripts'); host.append(frame);
  const token = doc.defaultView.crypto.randomUUID();
  // Messages are accepted only from this sandboxed frame, with its per-instance token.
  const listener = event => {
   if (event.source !== frame.contentWindow || event.data?.token !== token) return;
   if (event.data.type === 'resize' && Number.isFinite(event.data.height)) {
    const height = Math.min(30000, Math.max(36, Math.ceil(event.data.height)));
    if (frame.style.height !== `${height}px`) { frame.style.height = `${height}px`; view.requestMeasure(); }
   } else if (event.data.type === 'edit') open();
  };
  doc.defaultView.addEventListener('message', listener);
  host.cleanup = () => doc.defaultView.removeEventListener('message', listener);
  const bridge = `const send=(type,extra={})=>parent.postMessage({token:${JSON.stringify(token)},type,...extra},'*');new ResizeObserver(()=>send('resize',{height:document.body.getBoundingClientRect().height})).observe(document.body);document.addEventListener('click',event=>{if(!event.target.closest('a,button,input,label,audio,summary'))send('edit');});`;
  frame.srcdoc = this.shell.before + this.block.html + this.shell.after + `<script nonce="tonks-preview">${bridge}</script></body></html>`;
  return host;
 }
 destroy(dom) { dom.cleanup?.(); }
 ignoreEvent() { return true; }
}

export function createLivePreview(plugin) {
 const field = StateField.define({
  create: () => ({blocks:[],shell:null,decorations:Decoration.none}),
  update(value, transaction) {
   // Preserve untouched previews while typing; changed blocks stay editable until rendered.
   if (transaction.docChanged) {
    const changes=[];transaction.changes.iterChangedRanges((from,to)=>changes.push({from,to}));
    value={...value,blocks:value.blocks.filter(block=>!changes.some(change=>change.from<=block.to&&change.to>=block.from)).map(block=>({...block,from:transaction.changes.mapPos(block.from,1),to:transaction.changes.mapPos(block.to,-1)}))};
   }
   for (const effect of transaction.effects) if (effect.is(liveResult)) value = {...effect.value,decorations:Decoration.none};
   if (!plugin.settings.livePreview || transaction.state.field(editorLivePreviewField,false)) return {...value,decorations:Decoration.none};
   const selections = transaction.state.selection.ranges.map(range => ({from:transaction.state.doc.lineAt(range.from).from,to:transaction.state.doc.lineAt(range.to).to}));
   const ranges = visibleBlocks(value.blocks,selections,transaction.state.doc.length).map(block => Decoration.replace({widget:new BlogBlock(block,value.shell),block:true}).range(block.from,block.to));
   return {...value,decorations:Decoration.set(ranges,true)};
  },
  provide: field => EditorView.decorations.from(field,value=>value.decorations),
 });
 const worker = ViewPlugin.fromClass(class {
  constructor(view) { this.view=view; this.dead=false; this.generation=0; this.schedule(); plugin.liveWorkers.add(this); }
  update(update) { if(update.docChanged || update.transactions.some(t=>t.effects.some(e=>e.is(liveRefresh))))this.schedule(); }
  schedule() { clearTimeout(this.timer); this.generation++; if(!plugin.settings.livePreview)return; this.timer=setTimeout(()=>this.render(),300); }
  async render() {
   const generation=this.generation,view=this.view,info=view.state.field(editorInfoField,false);
   if(!info?.file || !plugin.settings.livePreview || view.state.field(editorLivePreviewField,false))return;
   const text=view.state.doc.toString(),file=info.file;
   try {
    const rendered=await plugin.renderLive(text,file);
    if(this.dead||generation!==this.generation||!plugin.settings.livePreview||view.state.doc.toString()!==text||view.state.field(editorInfoField,false)?.file?.path!==file.path)return;
    if(!Array.isArray(rendered.blocks))throw Error('博客适配器不支持实时预览，请先在博客目录运行 pnpm editor:build');
    const doc=new DOMParser().parseFromString(rendered.html,'text/html');
    const shell=liveShell(doc,view.dom?.ownerDocument);
    const blocks=lineBlocks(rendered.blocks,view.state.doc);
    view.dispatch({effects:liveResult.of({blocks,shell})});this.lastError='';
   } catch(error) { if(!this.dead&&generation===this.generation&&this.lastError!==error.message){this.lastError=error.message;plugin.liveError(error.message);} }
  }
  refresh() { this.view.dispatch({effects:liveRefresh.of(null)}); }
  destroy() { this.dead=true;this.generation++;clearTimeout(this.timer);plugin.liveWorkers.delete(this); }
 });
 return [field,worker];
}

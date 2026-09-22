// Resolve the adapter's actual CSS in an isolated frame, including var()/color functions.
// One probe per editor/theme also covers empty notes and notes with only the active block.
const colors={bg:'--card-bg',text:'--tw-prose-body',heading:'--tw-prose-headings',accent:'--primary',muted:'--text-secondary',border:'--line-divider',soft:'--btn-regular-bg'};
export class LiveTheme {
 constructor(view){this.view=view;this.saved=null;}
 update(shell){
  if(!this.view.dom||this.key===shell.before)return;
  this.stopProbe();this.key=shell.before;
  const doc=this.view.dom.ownerDocument,win=doc.defaultView;
  const frame=doc.createElement('iframe');frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-scripts');
  const token=win.crypto.randomUUID();
  const listener=event=>{
   if(event.source!==frame.contentWindow||event.data?.token!==token||event.data.type!=='theme')return;
   const palette=event.data.colors;
   if(!palette||!Object.keys(colors).every(key=>typeof palette[key]==='string'&&win.CSS.supports('color',palette[key])))return;
   const root=this.view.dom.closest('.markdown-source-view')||this.view.dom;
   if(!this.saved){
    this.root=root;this.hadClass=root.classList.contains('tonks-live-editor');
    this.saved=new Map([...Object.keys(colors),'scheme'].map(key=>{const name='--tonks-live-'+key;return [name,[root.style.getPropertyValue(name),root.style.getPropertyPriority(name)]];}));
   }
   for(const key of Object.keys(colors))root.style.setProperty('--tonks-live-'+key,palette[key]);
   root.style.setProperty('--tonks-live-scheme',event.data.dark?'dark':'light');
   root.classList.add('tonks-live-editor');
  };
  win.addEventListener('message',listener);
  this.stopProbe=()=>{win.removeEventListener('message',listener);frame.remove();};
  // Only theme CSS is loaded: no article contents, remote assets or article interactions.
  const preview=new win.DOMParser().parseFromString(shell.before,'text/html');
  const head=preview.head.outerHTML,root=preview.documentElement;
  const script=`const probe=document.createElement('span');document.body.append(probe);const colors={};for(const [key,name] of Object.entries(${JSON.stringify(colors)})){probe.style.color='var('+name+')';colors[key]=getComputedStyle(probe).color;}parent.postMessage({token:${JSON.stringify(token)},type:'theme',colors,dark:document.documentElement.classList.contains('dark')},'*');`;
  frame.srcdoc=`<!doctype html><html class="${root.classList.contains('dark')?'dark':''}" data-yellow="${root.dataset.yellow==='true'}">${head}<body><script nonce="tonks-preview">${script}</script></body></html>`;
  this.view.dom.append(frame);
 }
 stopProbe(){}
 clear(){
  this.stopProbe();this.stopProbe=()=>{};this.key=null;
  if(this.saved){
   for(const [name,[value,priority]] of this.saved)if(value)this.root.style.setProperty(name,value,priority);else this.root.style.removeProperty(name);
   if(!this.hadClass)this.root.classList.remove('tonks-live-editor');
   this.saved=null;
  }
 }
}

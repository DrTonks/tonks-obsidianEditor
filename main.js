import {Plugin, MarkdownView, Modal, Setting, Notice, FuzzySuggestModal, PluginSettingTab} from 'obsidian';
import fs from 'node:fs/promises';
import path from 'node:path';
import {template,insertion} from './formats.mjs';
import {loadConfig,loadAdapter,findBlogRoot} from './config.mjs';

class Choose extends FuzzySuggestModal {
 constructor(app,items,callback){super(app);this.items=items;this.callback=callback;this.setPlaceholder('搜索标题或路径…');}
 getItems(){return this.items;} getItemText(item){return item.label;}
 onChooseItem(item){this.callback(item);}
}
class Fields extends Modal {
 constructor(app,title,fields,done){super(app);this.title=title;this.fields=fields;this.done=done;}
 onOpen(){this.contentEl.createEl('h2',{text:this.title});const values={};for(const [key,label,value] of this.fields){values[key]=value||'';new Setting(this.contentEl).setName(label).addText(t=>t.setValue(values[key]).onChange(v=>values[key]=v));}
 new Setting(this.contentEl).addButton(b=>b.setButtonText('插入').setCta().onClick(()=>{try{this.done(values);this.close();}catch(e){new Notice(e.message);}}));}
 onClose(){this.contentEl.empty();}
}
export default class BlogTools extends Plugin {
 async onload(){
  this.settings=Object.assign({blogRoot:'',configPath:'editor/blog-editor.json',theme:'light-blue'},await this.loadData());
  this.overlays=new Set();
  this.registerEvent(this.app.workspace.on("file-open",()=>{for(const close of [...this.overlays])close();}));
  this.addSettingTab(new Settings(this.app,this));
  this.addCommand({id:'preview',name:'博客预览 / 返回编辑',editorCallback:(_e,v)=>this.preview(v)});
  this.addRibbonIcon('book-open','博客预览',()=>{const view=this.app.workspace.getActiveViewOfType(MarkdownView);if(view)this.preview(view);else new Notice('请先打开一篇 Markdown 文章');});
  this.registerEvent(this.app.workspace.on('editor-menu',(menu,editor,view)=>{
   menu.addSeparator();menu.addItem(item=>item.setTitle('博客预览').setIcon('book-open').onClick(()=>this.preview(view)));
   try{const config=this.readConfig();menu.addItem(item=>{item.setTitle(config.name+' · 格式').setIcon('blocks');const sub=item.setSubmenu();for(const f of config.formats)sub.addItem(i=>i.setTitle(f.name).onClick(()=>this.insert(f.id,editor,view)));});}catch(e){menu.addItem(item=>item.setTitle('博客配置不可用：'+e.message).setDisabled(true));}
  }));
  this.addCommand({id:'insert-format',name:'选择博客格式',editorCallback:(e,v)=>{try{new Choose(this.app,this.readConfig().formats.map(f=>({label:f.name,id:f.id})),f=>this.insert(f.id,e,v)).open();}catch(error){new Notice(error.message);}}});
 }
 onunload(){for(const close of this.overlays)close();}
 root(){return this.settings.blogRoot.trim()||findBlogRoot(this.app.vault.adapter.getBasePath());}
 readConfig(){const root=this.root();if(!root)throw Error('请在设置中指定博客项目目录');this.config=loadConfig(root,this.settings.configPath);return this.config;}
 async insert(kind,editor,view){
  let config,format;try{config=this.readConfig();format=config.formats.find(f=>f.id===kind);if(!format)throw Error('格式已被移除');}catch(e){new Notice(e.message);return;}
  const original=editor.getValue(),from=editor.posToOffset(editor.getCursor('from')),to=editor.posToOffset(editor.getCursor('to')),selected=original.slice(from,to);
  const apply=props=>{
   if(editor.getValue()!==original)throw new Error('选择格式期间文档已变化，请重新选择插入位置');
   const body=template(format,selected,props),result=insertion(original,from,to,body);
   editor.replaceRange(result.text,editor.offsetToPos(from),editor.offsetToPos(to));
   const placeholder=body.indexOf(selected||'在这里填写内容');
   const start=from+result.offset+(placeholder>=0?placeholder:body.length);
   editor.setSelection(editor.offsetToPos(start),editor.offsetToPos(start+(placeholder>=0?(selected||'在这里填写内容').length:0)));editor.focus();
  };
  if(format.picker==='post'){
   const items=this.app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(config.postsPath.replace(/\/$/,'')+'/')).map(f=>({label:`${this.app.metadataCache.getFileCache(f)?.frontmatter?.title||f.basename} — ${f.path}`,slug:f.path.slice(config.postsPath.replace(/\/$/,'').length+1,-3)}));
   new Choose(this.app,items,item=>{try{apply({slug:item.slug});}catch(e){new Notice(e.message);}}).open();return;
  }
  const fields=(format.fields||[]).map(f=>[f.key,f.label,f.default||'']);
  if(fields.length)new Fields(this.app,format.name,fields,apply).open();else {try{apply({});}catch(e){new Notice(e.message);}}
 }
 async localAsset(src,file){
  if(!src||/^(https?:|data:)/i.test(src))return src;
  if(/^[a-z]+:/i.test(src)||src.startsWith('//'))return '';
  const vaultRoot=this.app.vault.adapter.getBasePath();
  const root=src.startsWith('/')?path.join(this.root(),this.config?.publicPath||'public'):vaultRoot;
  let target=src.startsWith('/')?path.join(root,decodeURIComponent(src.slice(1))):path.resolve(vaultRoot,path.dirname(file.path),decodeURIComponent(src.split(/[?#]/)[0]));
  try{
   const [realRoot,realTarget]=await Promise.all([fs.realpath(root),fs.realpath(target)]);
   const relative=path.relative(realRoot,realTarget);if(relative.startsWith('..')||path.isAbsolute(relative))return '';
   const ext=path.extname(realTarget).toLowerCase();const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4'};
   if(!types[ext])return '';const info=await fs.stat(realTarget);if(info.size>30*1024*1024)return '';
   return `data:${types[ext]};base64,${(await fs.readFile(realTarget)).toString('base64')}`;
  }catch{return '';}
 }
 async preview(view){
  if(!view?.file||!view.editor){new Notice('请在 Markdown 编辑页面打开预览');return;}
  if(view.contentEl.querySelector('.tonks-preview-overlay')){view.contentEl.querySelector('.tonks-preview-close')?.click();return;}
  let config;try{config=this.readConfig();}catch(e){new Notice(e.message);return;}
  const file=view.file,text=view.editor.getValue();
  const overlay=view.contentEl.createDiv({cls:'tonks-preview-overlay'});const toolbar=overlay.createDiv({cls:'tonks-preview-toolbar'});
  const close=()=>{overlay.remove();this.overlays.delete(close);view.editor.focus();};this.overlays.add(close);
  const button=toolbar.createEl('button',{text:'← 返回编辑',cls:'tonks-preview-close'});button.onclick=close;
  toolbar.createSpan({text:file.basename});const theme=toolbar.createEl('select');
  for(const t of config.themes){const option=theme.createEl('option',{text:t.name});option.value=t.id;}theme.value=config.themes.some(t=>t.id===this.settings.theme)?this.settings.theme:config.themes[0].id;
  const width=toolbar.createEl('button',{text:'手机宽度'});const status=overlay.createDiv({text:'正在渲染当前文章…',cls:'tonks-preview-status'});
  const frame=overlay.createEl('iframe',{cls:'tonks-preview-frame'});frame.setAttribute('sandbox','allow-scripts');frame.title='博客文章预览';
  width.onclick=()=>{frame.classList.toggle('tonks-preview-mobile');width.textContent=frame.classList.contains('tonks-preview-mobile')?'桌面宽度':'手机宽度';};
  let generation=0;
  const draw=async()=>{const current=++generation;try{
   const adapter=loadAdapter(this.root(),config);
   const rendered=await adapter.renderPreview({text,file,theme:theme.value,root:this.root(),config,
    parseHtml:html=>new DOMParser().parseFromString(html,'text/html'),
    findPost:slug=>this.app.vault.getAbstractFileByPath(config.postsPath.replace(/\/$/,'')+'/'+slug+'.md'),
    metadata:f=>this.app.metadataCache.getFileCache(f)?.frontmatter,
    resolveAsset:(src,f)=>this.localAsset(src,f)});
   if(!overlay.isConnected||current!==generation)return;
   frame.srcdoc=rendered.html;
   status.hidden=!rendered.missing;status.textContent=rendered.missing?`${rendered.missing} 个本地资源未找到或超过 30MB。`:'';
  }catch(e){status.hidden=false;status.textContent='预览失败：'+e.message;new Notice(status.textContent);}};
  theme.onchange=()=>{this.settings.theme=theme.value;this.saveData(this.settings);return draw();};await draw();
 }
}
class Settings extends PluginSettingTab {
 constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
 display(){this.containerEl.empty();this.containerEl.createEl('h2',{text:'博客工具'});
  for(const [key,label,desc]of [['blogRoot','博客项目目录','留空时从工作区向上查找 editor/blog-editor.json。'],['configPath','编辑器配置路径','相对于博客根目录；默认 editor/blog-editor.json。配置中的本地预览模块仅应来自你信任的博客代码。']])new Setting(this.containerEl).setName(label).setDesc(desc).addText(t=>t.setValue(this.plugin.settings[key]).onChange(async value=>{this.plugin.settings[key]=value;await this.plugin.saveData(this.plugin.settings);}));
 }
}

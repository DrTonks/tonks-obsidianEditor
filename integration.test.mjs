import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://obsidian.test'});const win=dom.window;
win.HTMLElement.prototype.createEl=function(tag,opts={}){const e=win.document.createElement(tag);if(opts.cls)e.className=opts.cls;if(opts.text)e.textContent=opts.text;this.append(e);return e};
win.HTMLElement.prototype.createDiv=function(opts){return this.createEl('div',opts)};win.HTMLElement.prototype.createSpan=function(opts){return this.createEl('span',opts)};
class Plugin{async loadData(){return {}} async saveData(){} registerEvent(){} addSettingTab(){} addCommand(){} addRibbonIcon(){}}
const api={Plugin,MarkdownView:class{},Modal:class{},Setting:class{},Notice:class{constructor(text){throw Error(text)}},FuzzySuggestModal:class{},PluginSettingTab:class{}};
const mod={exports:{}};const context=vm.createContext({module:mod,exports:mod.exports,require:id=>id==='obsidian'?api:require(id),console,Buffer,process,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,DOMParser:win.DOMParser,document:win.document,window:win});
vm.runInContext(fs.readFileSync('dist/main.js','utf8'),context);const Tools=mod.exports.default;
test('actual plugin builds snapshot, themes and returns without touching editor',async()=>{
 const plugin=new Tools();plugin.app={workspace:{on:()=>({})},vault:{adapter:{getBasePath:()=>path.resolve('../blogExample/src/content')},getAbstractFileByPath:()=>null},metadataCache:{}};await plugin.onload();
 const text='---\ntitle: 测试文章\n---\n:::quote{author="Tonks"}\n正文\n:::\n\n::github{repo="DrTonks/tonks-blog"}\n\n::post{slug="memory/memory"}';
 let focused=0;const view={file:{path:'posts/test.md',basename:'test'},contentEl:win.document.body.createDiv(),editor:{getValue:()=>text,focus:()=>focused++}};
 await plugin.preview(view);const frame=view.contentEl.querySelector('iframe');assert.ok(frame);assert.match(frame.srcdoc,/article-quote/);assert.match(frame.srcdoc,/preview-github/);assert.match(frame.srcdoc,/article-post-card/);assert.match(frame.srcdoc,/post-card-placeholder/);assert.equal(frame.getAttribute('sandbox'),'allow-scripts');
 const select=view.contentEl.querySelector('select');assert.equal(select.value,'light-blue');select.value='dark-yellow';await select.onchange();assert.match(frame.srcdoc,/<html class="dark" data-yellow="true">/);
 fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/actual-preview.html',frame.srcdoc);await plugin.preview(view);assert.equal(view.contentEl.querySelector('iframe'),null);assert.equal(view.editor.getValue(),text);assert.equal(focused,1);plugin.onunload();
});
test('local resources cannot escape the configured vault',async()=>{const plugin=new Tools();plugin.settings={blogRoot:path.resolve('../blogExample')};plugin.app={vault:{adapter:{getBasePath:()=>path.resolve('../blogExample/src/content')}}};assert.equal(await plugin.localAsset('../../../../serverSSH.txt',{path:'posts/test.md'}),'');assert.equal(await plugin.localAsset('file:///C:/private.png',{path:'posts/test.md'}),'');});

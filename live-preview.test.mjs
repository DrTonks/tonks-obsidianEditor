import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const {EditorState,StateField}=require('@codemirror/state');
const nativePreview=StateField.define({create:()=>false,update:v=>v});
const api={editorLivePreviewField:nativePreview,editorInfoField:StateField.define({create:()=>({file:{path:'post.md'}}),update:v=>v})};
const bundle=await build({entryPoints:['live-preview.js'],bundle:true,write:false,platform:'node',format:'cjs',external:['obsidian','@codemirror/state','@codemirror/view']});
const mod={exports:{}};
const viewAPI={...require('@codemirror/view'),ViewPlugin:{fromClass:cls=>cls}};
vm.runInNewContext(bundle.outputFiles[0].text,{module:mod,exports:mod.exports,require:id=>id==='obsidian'?api:id==='@codemirror/view'?viewAPI:require(id),setTimeout,clearTimeout,console,DOMParser:new JSDOM('').window.DOMParser});
const {createLivePreview,liveResult,liveRefresh,visibleBlocks,lineBlocks}=mod.exports;

test('only valid inactive blocks are rendered; spanning selections retain source',()=>{
 const blocks=[{from:0,to:4},{from:6,to:10},{from:12,to:18},{from:17,to:20},{from:-1,to:2}];
 assert.deepEqual(Array.from(visibleBlocks(blocks,[{from:7,to:14}],20),b=>b.from),[0]);
});
test('decorations follow unrelated edits, reveal selected source, and disappear on disable',()=>{
 const plugin={settings:{livePreview:true},liveWorkers:new Set()};
 const [field]=createLivePreview(plugin);
 let state=EditorState.create({doc:'one\n\ntwo\n\nthree',selection:{anchor:0},extensions:[field,nativePreview]});
 state=state.update({effects:liveResult.of({blocks:[{from:0,to:3,html:'one'},{from:5,to:8,html:'two'},{from:10,to:15,html:'three'}],shell:{before:'',after:''}})}).state;
 assert.equal(state.field(field).decorations.size,2);
 state=state.update({changes:{from:1,insert:'!'}}).state;
 assert.equal(state.field(field).decorations.size,2);
 assert.equal(state.field(field).blocks[0].from,6);
 state=state.update({selection:{anchor:7}}).state;
 assert.equal(state.field(field).decorations.size,1);
 plugin.settings.livePreview=false;
 state=state.update({effects:liveRefresh.of(null)}).state;
 assert.equal(state.field(field).decorations.size,0);
});


test('out-of-order and destroyed renders cannot restore stale preview blocks',async()=>{
 const pending=[],updates=[];
 const plugin={settings:{livePreview:true},liveWorkers:new Set(),renderLive:()=>new Promise(resolve=>pending.push(resolve)),liveError:message=>assert.fail(message)};
 const [,Worker]=createLivePreview(plugin);
 const view={state:EditorState.create({doc:'one',extensions:[api.editorInfoField,nativePreview]}),dispatch:update=>updates.push(update)};
 const worker=new Worker(view);clearTimeout(worker.timer);
 const first=worker.render();worker.schedule();clearTimeout(worker.timer);
 const second=worker.render();
 const result={html:'<html><head></head><body></body></html>',blocks:[{from:0,to:3,html:'<p>one</p>'}]};
 pending[1](result);await second;assert.equal(updates.length,1);
 pending[0](result);await first;assert.equal(updates.length,1);
 const third=worker.render();worker.destroy();pending[2](result);await third;
 assert.equal(updates.length,1);assert.equal(plugin.liveWorkers.size,0);
});

test('whole-line blocks preserve same-line HTML siblings and leave unmapped text editable',()=>{
 const normalize=(text,blocks)=>Array.from(lineBlocks(blocks,EditorState.create({doc:text}).doc));
 const text='<p>一</p><p>二</p>';
 const blocks=[{from:0,to:8,html:'<p>一</p>'},{from:8,to:16,html:'<p>二</p>'}];
 const result=normalize(text,blocks);
 assert.equal(result.length,1);assert.equal(result[0].from,0);assert.equal(result[0].to,text.length);assert.equal(result[0].html,text);
 assert.equal(normalize('<div>一</div>尾巴',[{from:0,to:12,html:'<div>一</div>'}]).length,0);
 assert.equal(normalize('前缀<div>一</div>',[{from:2,to:14,html:'<div>一</div>'}]).length,0);
 assert.equal(normalize('a GAP b',[{from:0,to:1,html:'a'},{from:6,to:7,html:'b'}]).length,0);
 assert.equal(normalize('a b',[{from:0,to:2,html:'a'},{from:1,to:3,html:'b'}]).length,0);
 assert.equal(normalize('one\ntwo',[{from:0,to:4,html:'one'},{from:4,to:7,html:'two'}]).length,2);
});

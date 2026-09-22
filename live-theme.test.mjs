import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {LiveTheme} from './live-theme.js';

test('theme probe isolates messages, replaces old themes, and restores the editor on exit',()=>{
 const win=new JSDOM('<body><div class="markdown-source-view"><div class="cm-editor"></div></div><div id="other"></div></body>').window;
 win.CSS={supports:(key,value)=>key==='color'&&/^#[0-9a-f]{6}$/.test(value)};
 const view={dom:win.document.querySelector('.cm-editor')},root=view.dom.parentElement;
 root.style.setProperty('--tonks-live-bg','#123456','important');
 const theme=new LiveTheme(view);
 const shell=dark=>({before:`<!doctype html><html class="${dark?'dark':''}" data-yellow="true"><head><style>:root{--card-bg:#ffffff}</style></head><body>`,after:''});
 const values=bg=>({bg,text:'#333333',heading:'#222222',accent:'#aaaa00',muted:'#555555',border:'#cccccc',soft:'#ffffdd'});
 const message=(frame,colors,source=frame.contentWindow)=>{
  const token=JSON.parse(frame.srcdoc.match(/token:("[^"\n]+")/)[1]);
  win.dispatchEvent(new win.MessageEvent('message',{source,data:{token,type:'theme',colors,dark:false}}));
 };
 theme.update(shell(false));const first=view.dom.querySelector('iframe');
 assert.equal(first.getAttribute('sandbox'),'allow-scripts');assert.equal(first.hidden,true);
 message(first,values('#ffffff'),win);assert.equal(root.classList.contains('tonks-live-editor'),false);
 message(first,values('url(https://example.com)'));assert.equal(root.classList.contains('tonks-live-editor'),false);
 message(first,values('#ffffff'));assert.equal(root.style.getPropertyValue('--tonks-live-bg'),'#ffffff');
 assert.equal(win.document.querySelector('#other').className,'');
 theme.update(shell(false));assert.equal(view.dom.querySelector('iframe'),first);
 theme.update(shell(true));const second=view.dom.querySelector('iframe');assert.notEqual(first,second);
 message(first,values('#eeeeee'));assert.equal(root.style.getPropertyValue('--tonks-live-bg'),'#ffffff');
 message(second,values('#111111'));assert.equal(root.style.getPropertyValue('--tonks-live-bg'),'#111111');
 theme.clear();assert.equal(view.dom.querySelector('iframe'),null);assert.equal(root.classList.contains('tonks-live-editor'),false);
 assert.equal(root.style.getPropertyValue('--tonks-live-bg'),'#123456');assert.equal(root.style.getPropertyPriority('--tonks-live-bg'),'important');
 assert.equal(root.style.getPropertyValue('--tonks-live-text'),'');
 message(second,values('#ffffff'));assert.equal(root.style.getPropertyValue('--tonks-live-bg'),'#123456');
 win.close();
});

import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {loadConfig,loadAdapter,validateConfig} from './config.mjs';import {template} from './formats.mjs';
test('new configuration and adapter code become visible without rebuilding plugin',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-config-'));try{
 fs.mkdirSync(path.join(root,'public'));fs.writeFileSync(path.join(root,'style.css'),'');
 const config={schemaVersion:1,name:'Example',postsPath:'posts',publicPath:'public',siteUrl:'https://example.test/',renderer:'adapter.cjs',styles:['style.css'],themes:[{id:'light',name:'亮色'}],formats:[]};
 fs.writeFileSync(path.join(root,'adapter.cjs'),'exports.apiVersion=1;exports.renderPreview=()=>"old";');fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(config));
 assert.equal(loadAdapter(root,loadConfig(root,'config.json')).renderPreview(),'old');
 config.formats.push({id:'new-quote',name:'新引用',kind:'container',directive:'quote',attributes:{author:'{{author}}'},fields:[{key:'author',label:'来源',default:'默认作者'}]});
 fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(config));assert.match(template(loadConfig(root,'config.json').formats[0],'文字'),/默认作者/);
 fs.writeFileSync(path.join(root,'adapter.cjs'),'exports.apiVersion=1;exports.renderPreview=()=>"new";');assert.equal(loadAdapter(root,loadConfig(root,'config.json')).renderPreview(),'new');
 const invalid={...config,formats:[config.formats[0],config.formats[0]]};assert.throws(()=>validateConfig(invalid));assert.throws(()=>loadConfig(root,'../outside.json'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

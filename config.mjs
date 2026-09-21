import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const moduleCache=new Map();
export function validateConfig(config){
 if(config.schemaVersion!==1||!Array.isArray(config.formats)||!Array.isArray(config.styles)||!Array.isArray(config.themes)||!config.themes.length)throw Error('博客编辑器配置版本或结构不正确');
 for(const key of ['renderer','postsPath','publicPath'])if(typeof config[key]!=='string'||!config[key])throw Error('缺少配置：'+key);
 if(!/^https?:\/\//.test(config.siteUrl))throw Error('siteUrl 必须为 HTTP(S) 地址');
 const ids=new Set();for(const f of config.formats){if(!/^[\w-]+$/.test(f.id)||ids.has(f.id)||typeof f.name!=='string'||!['leaf','container'].includes(f.kind)||!/^[a-z][a-z0-9-]*$/.test(f.directive))throw Error('无效或重复格式：'+f.id);ids.add(f.id);
 for(const field of f.fields||[])if(!/^[a-zA-Z][\w-]*$/.test(field.key)||!['text','audio-url','repository'].includes(field.type||'text'))throw Error('无效字段：'+field.key);
 for(const key of Object.keys(f.attributes||{}))if(!/^[a-zA-Z][\w-]*$/.test(key))throw Error('无效属性：'+key);
 }return config;
}
export function inside(root,relative){
 if(typeof relative!=='string'||path.isAbsolute(relative))throw Error('配置中的文件路径必须相对于博客目录');
 const base=fs.realpathSync(root),resolved=fs.realpathSync(path.resolve(base,relative));const rel=path.relative(base,resolved);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('配置文件超出博客目录');return resolved;
}
export function loadConfig(root,relative='editor/blog-editor.json'){
 const config=validateConfig(JSON.parse(fs.readFileSync(inside(root,relative),'utf8')));
 inside(root,config.renderer);for(const style of config.styles)inside(root,style);
 if(path.isAbsolute(config.postsPath)||config.postsPath.split(/[\\/]/).includes('..'))throw Error('postsPath 必须位于工作区内');
 inside(root,config.publicPath);return config;
}
export function loadAdapter(root,config){
 const file=inside(root,config.renderer),digest=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(moduleCache.get(file)?.digest===digest)return moduleCache.get(file).adapter;
 const localRequire=createRequire(file);delete localRequire.cache[file];const adapter=localRequire(file);
 if(adapter.apiVersion!==1||typeof adapter.renderPreview!=='function')throw Error('预览适配器接口版本不兼容');moduleCache.set(file,{digest,adapter});return adapter;
}
export function findBlogRoot(vaultRoot){let current=path.resolve(vaultRoot);while(true){if(fs.existsSync(path.join(current,'editor/blog-editor.json')))return current;const parent=path.dirname(current);if(parent===current)return '';current=parent;}}

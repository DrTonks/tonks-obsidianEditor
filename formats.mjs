export function escapeAttribute(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/[\r\n]/g,' ');}
export function template(format,selected='',props={}){
 const values={...props};for(const f of format.fields||[]){let value=String(values[f.key]??f.default??'');if(f.required&&!value.trim())throw Error('请填写：'+f.label);if(f.type==='audio-url'&&!/^(\/[^/]|https?:\/\/)/i.test(value))throw Error('音频地址必须为 / 开头路径或 HTTP(S) 网址');if(f.type==='repository'){value=value.trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,'');if(!/^[\w.-]+\/[\w.-]+$/.test(value))throw Error('请输入 owner/repo 或 GitHub 仓库网址');}values[f.key]=value;}
 const attributes=Object.entries(format.attributes||{}).map(([k,v])=>`${k}="${escapeAttribute(String(v).replace(/\{\{([\w-]+)\}\}/g,(_m,key)=>{if(!(key in values))throw Error('模板缺少参数：'+key);return values[key];}))}"`).join(' ');
 const opening=format.directive+(attributes?'{'+attributes+'}':'');if(format.kind==='leaf')return '::'+opening;
 const content=selected||format.placeholder||'在这里填写内容';const fence=':'.repeat(Math.max(3,...[...content.matchAll(/^(:{3,})/gm)].map(m=>m[1].length+1)));return `${fence}${opening}\n${content}\n${fence}`;
}
export function insertion(text,from,to,body){const before=text.slice(0,from),after=text.slice(to);const prefix=before?(before.endsWith('\n\n')?'':before.endsWith('\n')?'\n':'\n\n'):'';const suffix=after?(after.startsWith('\n\n')?'':after.startsWith('\n')?'\n':'\n\n'):'\n';return {text:prefix+body+suffix,offset:prefix.length};}

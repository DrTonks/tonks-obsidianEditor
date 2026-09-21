import fs from 'node:fs/promises';
import {build} from 'esbuild';
await fs.mkdir('dist',{recursive:true});
await build({bundle:true,platform:'node',format:'cjs',target:'es2022',entryPoints:['main.js'],outfile:'dist/main.js',external:['obsidian','electron'],logLevel:'info'});
for(const file of ['manifest.json','styles.css'])await fs.copyFile(file,'dist/'+file);

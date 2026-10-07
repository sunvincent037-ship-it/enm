'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const blocked=new Set(['source','sources','review','reviews','tmp','tools','node_modules']);
function runtimeAudio(){
 const context={DV:{}};context.globalThis=context;
 for(const name of ['roster','bt3-manifest','bt3-technique-voices','bt3-audio'])vm.runInNewContext(fs.readFileSync(path.join(root,'versus',name+'.js'),'utf8'),context);
 const DV=context.DV,catalog=DV.bt3Audio,ids=new Set();
 for(const bank of Object.values(catalog.sfx))for(const id of Object.values(bank))if(typeof id==='string')ids.add(id);
 for(const spec of DV.roster){const profile=DV.bt3Profile(catalog,spec);if(profile){for(const id of Object.values(profile.shorts))ids.add(id);for(const line of [500,503,504])if(profile.lines[line])ids.add(profile.lines[line]);}}
 for(const voices of Object.values(DV.bt3TechniqueVoices))for(const id of Object.values(voices))ids.add(id);
 const clips=Object.fromEntries([...ids].filter(id=>catalog.clips[id]).map(id=>[id,catalog.clips[id]]));
 return {...catalog,source:{description:'Runtime battle audio selection'},clips};
}
function build(options={}){
 const out=path.resolve(root,options.out||'deploy-package/mobile-online-release');
 if(out===root||!out.startsWith(root+path.sep))throw Error('Output must be a new directory inside the project.');
 if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output directory must be empty; existing files are preserved.');
 let serverURL=String(options.serverURL||'').trim();
 if(serverURL){const url=new URL(serverURL);if(url.protocol!=='https:'||url.username||url.password)throw Error('Production server URL must use HTTPS without credentials.');serverURL=url.origin;}
 fs.mkdirSync(out,{recursive:true});let count=0,bytes=0;
 function copy(relative){const source=path.join(root,relative),target=path.join(out,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);count++;bytes+=fs.statSync(source).size;}
 const runtime=fs.readdirSync(path.join(root,'versus')).filter(name=>/\.(js|css)$/.test(name)).map(name=>'versus/'+name);
 for(const name of ['index.html',...runtime])copy(name);
 const audio=runtimeAudio();
 fs.writeFileSync(path.join(out,'versus/bt3-manifest.js'),'(function(root){const DV=root.DV=root.DV||{};DV.bt3Audio='+JSON.stringify(audio)+';})(globalThis);\n');
 if(serverURL)fs.writeFileSync(path.join(out,'versus/network-config.js'),'globalThis.DV_NETWORK_CONFIG='+JSON.stringify({url:serverURL,sameOrigin:false})+';\n');
 fs.writeFileSync(path.join(out,'.nojekyll'),'');
 const sources=['index.html',...runtime];const references=new Set();
 for(const filename of sources){const content=fs.readFileSync(path.join(out,filename),'utf8');
  for(const match of content.matchAll(/assets\/[A-Za-z0-9_./-]+\.(?:png|webp|jpg|jpeg|gif|wav|mp3|ogg|woff2?|ttf)/g)){
   const ref=match[0];if(!ref.split('/').some(part=>blocked.has(part)))references.add(ref);
  }
 }
 for(const ref of references)copy(ref);
 const missing=[...references].filter(ref=>!fs.existsSync(path.join(out,ref)));
 if(missing.length)throw Error('Missing runtime assets: '+missing.slice(0,10).join(', '));
 const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
 for(const match of html.matchAll(/(?:src|href)=["'](versus\/[^"']+)["']/g))if(!fs.existsSync(path.join(out,match[1])))throw Error('Missing entry script: '+match[1]);
 if(!options.staticOnly){
  for(const name of ['server/index.cjs','package.json','package-lock.json','render.yaml','.github/workflows/pages.yml','scripts/build-online-release.cjs','docs/ONLINE-DEPLOYMENT.md'])copy(name);
  fs.writeFileSync(path.join(out,'.gitignore'),'node_modules/\n_site/\ndeploy-package/\n.env\n.env.*\n');
  fs.writeFileSync(path.join(out,'README.md'),'# Dragon Clash\n\n手机、平板和电脑浏览器对战游戏，支持双人房间联机。\n\n运行：`npm ci`，然后 `npm start`，打开 http://localhost:4173 。\n\n发布步骤见 [部署说明](docs/ONLINE-DEPLOYMENT.md)。\n');
 }
 const result={out,files:count,bytes,validatedAssetReferences:references.size,configuredOnline:!!serverURL};
 const {out:outputPath,...publicInfo}=result;fs.writeFileSync(path.join(out,'release-info.json'),JSON.stringify(publicInfo,null,2));return result;
}
if(require.main===module){const args=process.argv.slice(2),value=flag=>{const index=args.indexOf(flag);return index<0?undefined:args[index+1];};try{console.log(JSON.stringify(build({out:value('--out'),serverURL:value('--server-url')||process.env.RENDER_SERVER_URL,staticOnly:args.includes('--static')}),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={build,runtimeAudio};

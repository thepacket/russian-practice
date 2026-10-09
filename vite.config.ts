import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';

// Vite's static server labels .gz files "Content-Encoding: gzip", so the browser would unpack the dictionary
// and word-detail shards itself and the app's own decompression and checks would fail. Serve the raw bytes, as nginx does.
function rawDictionary(root:string):Plugin['configureServer']{
 return server=>{server.middlewares.use(async(req,res,next)=>{
  const path=req.url?.split('?')[0]??'';
  if(!/^\/(dictionary\/full-[0-9a-f]{64}|(words|forms)\/\d{4}-[0-9a-f]{16})\.json\.gz$/.test(path))return next();
  try{const body=await readFile(fileURLToPath(new URL(`${root}${path.slice(0,path.lastIndexOf('/')+1)}${basename(path)}`,import.meta.url)));res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Length',body.length);res.end(body);}catch{next();}
 });};
}

export default defineConfig({plugins:[react(),{name:'raw-dictionary',configureServer:rawDictionary('./public'),configurePreviewServer:rawDictionary('./dist') as Plugin['configurePreviewServer']}],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},build:{outDir:'dist',sourcemap:false}});

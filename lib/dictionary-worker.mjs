import {createDictionary} from './dictionary-loader.mjs';
const choose=createDictionary();
self.onmessage=async({data:{id,max,previous,rank=0,lookup}})=>{
 try{if(typeof lookup==='string'){self.postMessage({id,entries:await choose.lookup(lookup)});return;}const word=await choose(max,previous,undefined,status=>self.postMessage({id,status}),rank);self.postMessage({id,word});}
 catch(error){self.postMessage({id,error:error.message||'Dictionary unavailable. Try Next Word again.'});}
};

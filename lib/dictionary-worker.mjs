import {createDictionary} from './dictionary-loader.mjs';
const choose=createDictionary();
self.onmessage=async({data:{id,max,previous}})=>{
 try{const word=await choose(max,previous,undefined,status=>self.postMessage({id,status}));self.postMessage({id,word});}
 catch(error){self.postMessage({id,error:error.message||'Dictionary unavailable. Try Next Word again.'});}
};

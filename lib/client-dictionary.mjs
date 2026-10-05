export {createDictionary} from './dictionary-loader.mjs';
let worker, sequence=0;
const requests=new Map(),statusListeners=new Set();
let latestStatus='Downloading the whole dictionary…';
function publish(status){latestStatus=status;for(const listener of statusListeners)listener(status);}
export function subscribeDictionaryStatus(listener){statusListeners.add(listener);listener(latestStatus);return ()=>{statusListeners.delete(listener);};}
function getWorker(){
 if(worker)return worker;
 worker=new Worker(new URL('./dictionary-worker.mjs',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{if(data.status)publish(data.status);if(data.error)publish(data.error);const request=requests.get(data.id);if(!request)return;if(data.status){request.progress(data.status);return;}request.cleanup();data.error?request.reject(Error(data.error)):request.resolve(data.word);};
 worker.onerror=()=>{publish('Dictionary worker stopped. Try Next word again.');for(const request of [...requests.values()]){request.cleanup();request.reject(Error('Dictionary worker stopped. Try Next word again in an up-to-date browser.'));}worker?.terminate();worker=undefined;};
 return worker;
}
export function chooseWord(max,previous,signal,onProgress=(_status)=>{}){
 if(signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
 return new Promise((resolve,reject)=>{
  const current=getWorker(),id=++sequence;
  const cleanup=()=>{requests.delete(id);signal?.removeEventListener('abort',cancel);};
  const cancel=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
  requests.set(id,{resolve,reject,progress:onProgress,cleanup});signal?.addEventListener('abort',cancel,{once:true});
  // Cancelling a word request does not restart the shared full-dictionary download.
  current.postMessage({id,max,previous});
 });
}

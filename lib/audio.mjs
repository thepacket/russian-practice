export function toWav(chunks,sourceRate){
 const count=chunks.reduce((n,c)=>n+c.length,0),all=new Float32Array(count);let off=0;for(const c of chunks){all.set(c,off);off+=c.length;}
 const length=Math.min(128000,Math.floor(count*16000/sourceRate));const buffer=new ArrayBuffer(44+length*2),v=new DataView(buffer);const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
 str(0,'RIFF');v.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*2,true);
 // Area averaging avoids dropping whole capture samples when downsampling.
 for(let i=0;i<length;i++){const start=Math.floor(i*sourceRate/16000),end=Math.max(start+1,Math.floor((i+1)*sourceRate/16000));let n=0;for(let j=start;j<end&&j<count;j++)n+=all[j];n=Math.max(-1,Math.min(1,n/(end-start)));v.setInt16(44+i*2,n<0?n*32768:n*32767,true);}return buffer;
}

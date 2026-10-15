// Bound application JSON bodies by bytes, including chunked requests.
export async function readObject(request,limit=16384) {
 const bad=(message,status)=>Object.assign(new Error(message),{status});
 const reader=request.body?.getReader();if(!reader)throw bad('A JSON object is required.',400);
 const chunks=[];let length=0;
 try {
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw bad('Request body is too large.',413);}chunks.push(value);}
 } finally {reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw bad('Invalid JSON body.',400);}
 if(!body || typeof body!=='object' || Array.isArray(body))throw bad('A JSON object is required.',400);
 return body;
}

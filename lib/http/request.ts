export class RequestError extends Error {
  constructor(public status:number,message:string) {super(message);}
}
export async function readJson(req:Request,maxBytes=256_000):Promise<unknown> {
  const origin=req.headers.get('origin');
  if(origin && origin!==new URL(req.url).origin) throw new RequestError(403,'Cross-site writes are not allowed');
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new RequestError(415,'Send application/json');
  const length=Number(req.headers.get('content-length'));
  if(length>maxBytes) throw new RequestError(413,'Request is too large');
  if(!req.body) throw new RequestError(400,'JSON body required');
  const reader=req.body.getReader(); let size=0; const parts:Uint8Array[]=[];
  while(true) {
    const {done,value}=await reader.read(); if(done) break;
    size+=value.byteLength;
    if(size>maxBytes) {await reader.cancel(); throw new RequestError(413,'Request is too large');}
    parts.push(value);
  }
  const bytes=new Uint8Array(size); let at=0;
  for(const part of parts) {bytes.set(part,at); at+=part.length;}
  try {return JSON.parse(new TextDecoder().decode(bytes));} catch {throw new RequestError(400,'Invalid JSON');}
}
export function errorResponse(error:unknown) {
  const status=error instanceof RequestError?error.status:503;
  return Response.json({error:error instanceof RequestError?error.message:'Sharing is temporarily unavailable. Your board is still saved in this browser.'},{status,headers:status===429?{'Retry-After':'900'}:undefined});
}

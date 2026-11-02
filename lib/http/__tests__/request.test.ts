import { describe,it,expect } from 'vitest';
import { readJson } from '../request';
describe('bounded JSON requests',()=>{
  it('rejects cross-origin writes, unsupported content types, and malformed JSON',async()=>{
    const req=(body:string,headers:Record<string,string>)=>new Request('https://nba.test/api/trade',{method:'POST',body,headers});
    await expect(readJson(req('{}',{'Content-Type':'application/json',Origin:'https://other.test'}))).rejects.toMatchObject({status:403});
    await expect(readJson(req('{}',{'Content-Type':'text/plain'}))).rejects.toMatchObject({status:415});
    await expect(readJson(req('{',{'Content-Type':'application/json'}))).rejects.toMatchObject({status:400});
  });
  it('enforces the actual streamed size without trusting Content-Length',async()=>{
    const req=new Request('https://nba.test/api/trade',{method:'POST',body:JSON.stringify({text:'a'.repeat(200)}),headers:{'Content-Type':'application/json'}});
    await expect(readJson(req,100)).rejects.toMatchObject({status:413});
  });
});

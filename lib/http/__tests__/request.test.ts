import {afterEach,describe,it,expect,vi} from 'vitest';
import { readJson } from '../request';
afterEach(()=>vi.unstubAllEnvs());
describe('bounded JSON requests',()=>{
  it('accepts the deployment origin behind a proxy while rejecting spoofed forwarded hosts',async()=>{
    vi.stubEnv('NBA_DEPLOY_ORIGINS','https://deploy-preview-20--nbatmz.netlify.app');
    const req=(origin:string)=>new Request('http://internal:3000/api/trade',{method:'POST',body:'{}',headers:{'Content-Type':'application/json',Origin:origin,'X-Forwarded-Host':'unrelated.test'}});
    await expect(readJson(req('https://deploy-preview-20--nbatmz.netlify.app'))).resolves.toEqual({});
    await expect(readJson(req('https://unrelated.test'))).rejects.toMatchObject({status:403});
  });
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

import {afterEach,describe,expect,it,vi} from 'vitest';
const query=vi.hoisted(()=>vi.fn().mockResolvedValue([{hits:1}]));
vi.mock('@/lib/data/db',()=>({db:()=>query,hasDb:()=>true}));
import {limitWrite} from '../rateLimit';
afterEach(()=>{vi.unstubAllEnvs();query.mockClear();});
describe('hosted write limits',()=>{
  it('uses Netlify runtime identity and separates clients without trusting forwarded-for',async()=>{
    vi.stubEnv('SITE_ID','nba-test-site');vi.stubEnv('NETLIFY','');
    const req=(ip:string,forwarded:string)=>new Request('https://nba.test/api/trade',{headers:{'x-nf-client-connection-ip':ip,'x-forwarded-for':forwarded}});
    await limitWrite(req('192.0.2.1','spoof-a'),'share');
    await limitWrite(req('192.0.2.1','spoof-b'),'share');
    await limitWrite(req('192.0.2.2','spoof-a'),'share');
    const keys=query.mock.calls.map(args=>args[1]);
    expect(keys[0]).toBe(keys[1]);expect(keys[0]).not.toBe(keys[2]);
  });
});

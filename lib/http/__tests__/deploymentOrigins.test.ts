import {afterEach,describe,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
async function origins(context:string) {
  vi.stubEnv('CONTEXT',context);
  vi.stubEnv('DEPLOY_PRIME_URL','https://main--nbatmz.netlify.app');
  vi.stubEnv('DEPLOY_URL','https://deploy-id--nbatmz.netlify.app');
  vi.stubEnv('URL','https://nbatm.zldagroup.com');
  const config=(await import('../../../next.config')).default;
  return config.env?.NBA_DEPLOY_ORIGINS?.split(',');
}
describe('deployment origins',()=>{
  it('keeps the production custom domain alongside deployment aliases',async()=>{
    expect(await origins('production')).toContain('https://nbatm.zldagroup.com');
  });
  it('does not add the production custom domain to an isolated preview',async()=>{
    const allowed=await origins('deploy-preview');
    expect(allowed).not.toContain('https://nbatm.zldagroup.com');
    expect(allowed).toContain('https://main--nbatmz.netlify.app');
  });
});

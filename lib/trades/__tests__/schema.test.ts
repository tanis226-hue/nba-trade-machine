import { describe,it,expect } from 'vitest';
import { tradeSchema,storedTradeSchema } from '../schema';
import { snapshotTrade } from '../snapshot';
const proposal=()=>({season:'2026-27',teams:[{abbr:'BOS',preTradeSalary:180_000_000},{abbr:'LAL',preTradeSalary:180_000_000}],
 assets:{player:{id:'player',kind:'player',salary:10_000_000,fromTeam:'BOS',toTeam:'LAL',label:'Player'}}});
describe('public trade boundary',()=>{
  it('reads a legacy single-team board while rejecting it as a new share',()=>{
    const board={season:'2026-27',teams:[{abbr:'BOS',preTradeSalary:180_000_000}],assets:{}};
    expect(storedTradeSchema.safeParse(board).success).toBe(true);
    expect(tradeSchema.safeParse(board).success).toBe(false);
  });
  it('reads a legacy untouched two-team board while rejecting a new empty share',()=>{
    const board=proposal();board.assets.player.toTeam='BOS';
    expect(storedTradeSchema.safeParse(board).success).toBe(true);
    expect(tradeSchema.safeParse(board).success).toBe(false);
  });
  it('retains routing and image safety checks when reading legacy boards',()=>{
    const board=proposal();board.assets.player.toTeam='MIA';
    expect(storedTradeSchema.safeParse(board).success).toBe(false);
    const remote=proposal();
    expect(storedTradeSchema.safeParse({...remote,assets:{player:{...remote.assets.player,headshot:'http://169.254.169.254/credentials'}}}).success).toBe(false);
  });
  it('accepts a routed proposal and rejects invalid amounts, routes, and duplicate teams',()=>{
    expect(tradeSchema.safeParse(proposal()).success).toBe(true);
    const negative=proposal();negative.assets.player.salary=-1;
    expect(tradeSchema.safeParse(negative).success).toBe(false);
    const route=proposal();route.assets.player.toTeam='MIA';
    expect(tradeSchema.safeParse(route).success).toBe(false);
    const duplicate=proposal();duplicate.teams[1].abbr='BOS';
    expect(tradeSchema.safeParse(duplicate).success).toBe(false);
  });
  it('rejects empty proposals, unsafe image hosts, and client-supplied verdicts',()=>{
    const empty=proposal();empty.assets.player.toTeam='BOS';
    expect(tradeSchema.safeParse(empty).success).toBe(false);
    expect(tradeSchema.safeParse({...proposal(),validation:{valid:true}}).success).toBe(false);
    const remote=proposal();
    expect(tradeSchema.safeParse({...remote,assets:{player:{...remote.assets.player,headshot:'http://169.254.169.254/credentials'}}}).success).toBe(false);
  });
  it('captures rules, date, data, and the server-computed verdict',()=>{
    const saved=snapshotTrade(tradeSchema.parse(proposal()));
    expect(saved.rulesVersion).toBeTruthy();expect(saved.dataVersion).toBeTruthy();
    expect(saved.simulatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(saved.validation.valid).toBe(false);
  });
});

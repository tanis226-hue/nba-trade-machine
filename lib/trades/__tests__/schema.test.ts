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
  it('reads the obsolete sign-and-trade method without carrying it into current matching',()=>{
    const board={season:'2026-27',teams:[{abbr:'BOS',preTradeSalary:180_000_000}],assets:{},tradeMethod:'sign_and_trade'};
    expect(storedTradeSchema.parse(board).tradeMethod).toBeUndefined();
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

  it('persists independent cash directions as proposal assumptions through snapshots',()=>{
    const input=proposal();
    const board={...input,teams:[{...input.teams[0],cashUsage:{season:'2026-27',sent:123}},
      {...input.teams[1],cashUsage:{season:'2026-27',received:0}}]};
    const saved=snapshotTrade(tradeSchema.parse(board));
    expect(saved.teams[0].cashUsage).toEqual({season:'2026-27',sent:123});
    expect(saved.teams[1].cashUsage).toEqual({season:'2026-27',received:0});
    expect(saved.rulesVersion).toBe('2026-11-02.4');
    for(const sent of [-1,0.5,NaN,Infinity])expect(tradeSchema.safeParse({...board,
      teams:[{...board.teams[0],cashUsage:{season:'2026-27',sent}},board.teams[1]]}).success).toBe(false);
  });

  it('requires positive whole-dollar moved cash on writes but keeps legacy amounts readable',()=>{
    const input=proposal();
    const cash={id:'cash',kind:'cash',label:'Cash',salary:0,fromTeam:'BOS',toTeam:'LAL',amount:1};
    expect(tradeSchema.safeParse({...input,assets:{cash}}).success).toBe(true);
    for(const amount of [undefined,0,0.5]) {
      const board={...input,assets:{cash:{...cash,amount}}};
      expect(tradeSchema.safeParse(board).success).toBe(false);
      expect(storedTradeSchema.safeParse(board).success).toBe(true);
    }
    expect(tradeSchema.safeParse({...input,assets:{...input.assets,cash:{...cash,toTeam:'BOS',amount:0}}}).success).toBe(true);
    expect(tradeSchema.safeParse({...input,assets:{cash:{...cash,salary:1}}}).success).toBe(false);
  });
});

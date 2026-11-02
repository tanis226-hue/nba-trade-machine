import { z } from 'zod';
import teams from '@/data/overrides/teams.json';

const team = z.string().refine((v) => teams.some((t) => t.abbr === v), 'Unknown NBA team');
const id = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_:-]+$/);
const money = z.number().finite().nonnegative().max(2_000_000_000);
const date = z.iso.date();
const season = z.enum(['2025-26', '2026-27']);
const option = z.enum(['team', 'player', 'eto', 'guaranteed']);
const protection = z.object({
  type: z.enum(['top', 'range', 'unprotected']).optional(), through: z.number().int().min(1).max(60).optional(),
  years: z.tuple([z.number().int(), z.number().int()]).optional(),
  range: z.tuple([z.number().int().min(1).max(60), z.number().int().min(1).max(60)]).optional(),
  rolloverToSecond: z.boolean().optional(), note: z.string().max(1500).optional(),
});
const exception = z.object({
  kind: z.enum(['tpe', 'non_taxpayer_mle', 'taxpayer_mle', 'room_mle', 'bae', 'room']),
  amount: money, expires: date.optional(), createdFromSignAndTrade: z.boolean().optional(), used: z.boolean().optional(),
});
const teamInput = z.object({
  abbr: team, preTradeSalary: money, apronSalary: money.optional(), capSpace: money.optional(),
  hardCapLine: money.nullish(), exceptions: z.array(exception).max(40).optional(),
  rosterCount: z.number().int().min(0).max(40).optional(), openRosterSpots: z.number().int().min(0).max(40).optional(),
  twoWayCount: z.number().int().min(0).max(10).optional(),
  toolsUsed: z.array(z.enum(['non_taxpayer_mle', 'bae', 'prior_year_tpe', 'sign_and_trade_acquire', 'taxpayer_mle'])).max(10).optional(),
  priorSecondApronSeasons: z.number().int().min(0).max(10).optional(),
  isRepeaterTaxpayer: z.boolean().optional(), priorTaxpayerSeasons: z.number().int().min(0).max(4).optional(),
  ownedFirstRoundPicks: z.array(z.object({year:z.number().int().min(2020).max(2040), conveyed:z.boolean().optional(), isSwap:z.boolean().optional()})).max(40).optional(),
});
const asset = z.object({
  id, kind: z.enum(['player', 'pick', 'cash', 'tpe']), salary: money, fromTeam: team, toTeam: team,
  label: z.string().min(1).max(200), apronSalary: money.optional(), tradeBonusPct: z.number().min(0).max(0.15).optional(),
  tradeBonusEarned: z.boolean().optional(),
  signedVia: z.enum(['bird','early_bird','non_bird','cap_room','non_taxpayer_mle','taxpayer_mle','room_mle','bae','minimum','rookie_scale','sign_and_trade','extension']).optional(),
  noTradeClause:z.boolean().optional(), impliedNtc:z.boolean().optional(), isTwoWay:z.boolean().optional(),
  isMinimum:z.boolean().optional(), isRookieScaleExtension:z.boolean().optional(), isBaseYearComp:z.boolean().optional(),
  bycPriorSalary:money.optional(), signed:z.boolean().optional(), restrictedFa:z.boolean().optional(),
  signedDate:date.optional(), acquiredDate:date.optional(), acquiredFrom:team.optional(), extendedDate:date.optional(),
  designatedVetDate:date.optional(), matchedOfferDate:date.optional(), isOver38:z.boolean().optional(), guaranteedThrough:date.optional(),
  age:z.number().min(16).max(60).optional(), maxSalary:money.optional(),
  futureSalaries:z.array(z.object({season:z.string().regex(/^20\d{2}-\d{2}$/),salary:money,optionType:option.optional()})).max(10).optional(),
  origSalary:money.optional(), order:z.number().int().min(0).max(1000).optional(),
  value:z.number().finite().min(-100).max(200).optional(), pts:z.number().min(0).max(200).optional(),
  reb:z.number().min(0).max(100).optional(), ast:z.number().min(0).max(100).optional(),
  position:z.string().max(20).optional(), height:z.string().max(30).optional(), weight:z.number().min(0).max(500).optional(), jersey:z.string().max(10).optional(),
  headshot:z.url().max(400).refine((v)=>{
    const u=new URL(v); return u.protocol==='https:' && ['cdn.nba.com','a.espncdn.com'].includes(u.hostname);
  }).optional(),
  pickYear:z.number().int().min(2020).max(2040).optional(), round:z.union([z.literal(1),z.literal(2)]).optional(),
  protections:protection.nullish(), isSwap:z.boolean().optional(), originalTeam:team.optional(), isFrozen:z.boolean().optional(),
  amount:money.optional(), expires:date.optional(),
});
const contract = z.object({season:z.string().regex(/^20\d{2}-\d{2}$/),salary:money,option_type:z.string().max(30),guarantee_status:z.string().max(30),no_trade_clause:z.boolean(),trade_bonus_pct:z.number().min(0).max(0.15).nullish(),trade_bonus_earned:z.boolean().optional()});
const shape = {
  season, teams:z.array(teamInput).min(2).max(7), assets:z.record(id,asset),
  contracts:z.record(id,z.array(contract).max(10)).optional(), simulatedDate:date.optional(),
  tradeMethod:z.enum(['simultaneous','non_simultaneous']).optional(),
};
const payloadObject = z.object(shape);
function relationships(p:z.infer<typeof payloadObject>,ctx:z.RefinementCtx) {
  const abbrs=p.teams.map(t=>t.abbr);
  if(new Set(abbrs).size!==abbrs.length) ctx.addIssue({code:'custom',message:'Teams must be unique',path:['teams']});
  const entries=Object.entries(p.assets);
  if(entries.length>300) ctx.addIssue({code:'custom',message:'Too many assets',path:['assets']});
  if(!entries.some(([,a])=>a.fromTeam!==a.toTeam)) ctx.addIssue({code:'custom',message:'Move an asset before sharing',path:['assets']});
  for(const [key,a] of entries) {
    if(key!==a.id || !abbrs.includes(a.fromTeam) || !abbrs.includes(a.toTeam)) ctx.addIssue({code:'custom',message:'Asset ID or team routing is invalid',path:['assets',key]});
    if(a.kind!=='player' && a.salary!==0) ctx.addIssue({code:'custom',message:'Non-player assets cannot match salary',path:['assets',key,'salary']});
  }
}
export const tradeSchema=payloadObject.strict().superRefine(relationships);
export const saveTradeSchema=payloadObject.extend({title:z.string().trim().min(1).max(120),slug:z.string().regex(/^[A-Za-z0-9_-]{10}$/).optional()}).strict().superRefine(relationships);
export type TradeRequest=z.infer<typeof tradeSchema>;
export const validSlug=(v:string)=>/^[A-Za-z0-9_-]{10}$/.test(v);

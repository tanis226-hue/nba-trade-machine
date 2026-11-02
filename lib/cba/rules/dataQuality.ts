import type { Rule,TradeFinding } from '../types';
import { LEGACY_CASH_USAGE_NOTE } from '../cash';
export const dataQualityRule:Rule=(ctx)=>{
  const findings:TradeFinding[]=[];
  for(const team of ctx.teams) {
    if(!team.incomingAssets.length&&!team.outgoingAssets.length)continue;
    for(const message of team.dataNotes??[])findings.push({code:'SOURCE_ASSUMPTION',severity:'conditional',teamAbbr:team.abbr,message});
    for(const asset of [...team.incomingAssets,...team.outgoingAssets])for(const note of asset.dataNotes??[]) {
      if(asset.kind==='cash' && note===LEGACY_CASH_USAGE_NOTE)continue;
      findings.push({code:'CONTRACT_SOURCE_ASSUMPTION',severity:'conditional',teamAbbr:team.abbr,message:`${asset.label}: ${note}`});
    }
  }
  return findings;
};

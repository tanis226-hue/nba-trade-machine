"""Fetch public ESPN roster facts; no database writes or hand-authored transactions.
Produces a reviewable source file in ignored out/. Reconciliation is a separate step.
"""
import concurrent.futures,datetime,hashlib,json,pathlib,re,unicodedata
import httpx

ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
FIX={'GS':'gsw','NO':'nop','NY':'nyk','SA':'sas','UTAH':'uta','WSH':'was'}

def slug(name):
    plain=''.join(c for c in unicodedata.normalize('NFD',name) if not unicodedata.combining(c))
    return 'p_'+re.sub(r'[^a-z0-9]+','_',plain.lower()).strip('_')

def fetch(team):
    url=BASE+'/teams/'+team['id']+'/roster'
    with httpx.Client(timeout=30,follow_redirects=True) as client:
        response=client.get(url);response.raise_for_status(); data=response.json()
    if data['season']['displayName']!='2026-27': raise ValueError('Unexpected roster season')
    athletes=data.get('athletes',[])
    if not 12<=len(athletes)<=21: raise ValueError('Unexpected roster size: '+team['abbreviation'])
    abbr=FIX.get(team['abbreviation'],team['abbreviation'].lower())
    rows=[]
    for athlete in athletes:
        contract=athlete.get('contract',{})
        rows.append({
            'player_id':slug(athlete['displayName']),'name':athlete['displayName'],'team_id':abbr,
            'espn_id':athlete['id'],'position':athlete.get('position',{}).get('abbreviation'),
            'age':athlete.get('age'),'years_of_service':athlete.get('experience',{}).get('years'),
            'headshot':athlete.get('headshot',{}).get('href'),'height':athlete.get('displayHeight'),
            'weight':athlete.get('weight'),'jersey':athlete.get('jersey'),
            'contract':contract,'contracts':athlete.get('contracts',[]),'source':url,
        })
    return rows

def main():
    response=httpx.get(BASE+'/teams?limit=40',timeout=30);response.raise_for_status()
    teams=[t['team'] for t in response.json()['sports'][0]['leagues'][0]['teams']]
    if len(teams)!=30: raise ValueError('Expected all 30 NBA teams')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows=[r for group in pool.map(fetch,teams) for r in group]
    ids=[r['player_id'] for r in rows]
    if len(set(ids))!=len(ids): raise ValueError('Player appears on multiple rosters')
    data={'season':'2026-27','retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'players':rows}
    out=ROOT/'scripts/rosters/out';out.mkdir(parents=True,exist_ok=True)
    text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    (out/'rosters.json').write_text(text,encoding='utf8')
    print(f'Fetched {len(rows)} roster entries across 30 teams; SHA256 {hashlib.sha256(text.encode()).hexdigest()}')

if __name__=='__main__': main()

"""Read public team cap-sheet facts into an ignored review file. No database writes."""
import datetime,hashlib,json,pathlib,re,time
import httpx
from selectolax.parser import HTMLParser

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'scripts/rosters/out'
BASE='https://www.salaryswish.com'

def number(text):
    match=re.search(r'-?\$[\d,]+',text)
    return int(match.group().replace('$','').replace(',','')) if match else None

def parse(html,url,team):
    tree=HTMLParser(html); sections=[]
    for table in tree.css('table.sw_teamProfileRosterSection__table'):
        headers=[t.text(strip=True) for t in table.css('tr')[0].css('th')]
        if not headers: continue
        title=headers[0]
        if not any(title.startswith(k) for k in ['Standard Roster','Two-Way','Dead Cap']): continue
        rows=[]
        for tr in table.css('tr')[1:]:
            cells=tr.css('td')
            if not cells:continue
            player=cells[0].css_first('a[href^="/players/"]')
            if not player:continue
            contract=[]
            for index,year in enumerate(headers):
                if not re.fullmatch(r'20\d\d-\d\d',year) or index>=len(cells): continue
                cell=cells[index]; cap=cell.css_first('.cap_hit')
                if cap is None:continue
                option='player' if cell.css_first('[title="Player Option"]') else 'team' if cell.css_first('[title="Team Option"]') else 'guaranteed'
                guaranteed=cell.css_first('.guaranteed'); base=cell.css_first('.base_salary')
                contract.append({'season':year,'salary':number(cap.text()),'baseSalary':number(base.text()) if base else None,
                    'guaranteed':number(guaranteed.text()) if guaranteed else None,'option_type':option})
            label=player.text(strip=True)
            parts=label.split(', ',1); name=f'{parts[1]} {parts[0]}' if len(parts)==2 else label
            images=[img.attributes.get('alt','') for img in tr.css('img')]
            rows.append({'name':name,'playerPath':player.attributes['href'],'status':cells[1].text(strip=True),
                'age':int(cells[3].text(strip=True)),'position':cells[4].text(strip=True),'terms':cells[5].text(strip=True),
                'flags':images,'contract':contract,'source':url})
        sections.append({'section':title,'players':rows})
    totals={}
    for heading in tree.css('h5'):
        label=heading.text(strip=True).split(':')[0].strip()
        spans=heading.css('span')
        if spans:totals[label]=spans[-1].text(strip=True)
    standard=next((s for s in sections if s['section'].startswith('Standard Roster')),None)
    if not standard or not 12<=len(standard['players'])<=21: raise ValueError('Unexpected standard roster for '+team['abbr'])
    declared=re.search(r'\((\d+)\s*-',standard['section'])
    if not declared or int(declared.group(1))!=len(standard['players']):raise ValueError('Parsed roster count differs from source header: '+team['abbr'])
    return {'teamId':team['id'],'abbr':team['abbr'],'url':url,'totals':totals,'sections':sections,
        'needsRosterExceptionReview':len(standard['players'])>15}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    initial=OUT/'salaryswish-celtics.html'
    if not initial.exists():initial.write_text(httpx.get(BASE+'/teams/celtics',timeout=30).raise_for_status().text,encoding='utf8')
    tree=HTMLParser(initial.read_text(encoding='utf8'))
    links={a.text(strip=True):a.attributes['href'] for a in tree.css('a[href^="/teams/"]')}
    teams=json.loads((ROOT/'data/overrides/teams.json').read_text(encoding='utf8'))
    result=[]
    with httpx.Client(timeout=30,follow_redirects=True) as client:
        for team in teams:
            name=team['name']
            if name=='LA Clippers':name='Los Angeles Clippers' if 'Los Angeles Clippers' in links else name
            href=links.get(name)
            if not href:raise ValueError('No observed source link for '+name)
            url=BASE+href; cache=OUT/('salaryswish-'+team['id']+'.html')
            if team['id']=='bos':html=initial.read_text(encoding='utf8')
            elif cache.exists():html=cache.read_text(encoding='utf8')
            else:
                time.sleep(1)
                response=client.get(url);response.raise_for_status();html=response.text;cache.write_text(html,encoding='utf8')
            result.append(parse(html,url,team))
    data={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':BASE,'teams':result}
    text=json.dumps(data,ensure_ascii=False,indent=2)+'\n';(OUT/'capsheets.json').write_text(text,encoding='utf8')
    print(f'Read {len(result)} public cap sheets; SHA256 {hashlib.sha256(text.encode()).hexdigest()}')

if __name__=='__main__':main()

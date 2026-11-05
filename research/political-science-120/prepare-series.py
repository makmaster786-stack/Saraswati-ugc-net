import json, re, random
from pathlib import Path
import pdfplumber

ROOT=Path(__file__).resolve().parent
SOURCE=Path(r'C:/Users/ABC/Downloads/NEW net book 2026.pdf')
out=ROOT/'working'
out.mkdir(exist_ok=True)
cache=out/'english-pages.json'
if cache.exists():
    pages=json.loads(cache.read_text(encoding='utf-8'))
else:
    pages=[]
    with pdfplumber.open(SOURCE) as pdf:
        for i,page in enumerate(pdf.pages):
            # Preserve the English column, including its own matching-list layout.
            text=page.crop((35,35,306,page.height-32)).extract_text(x_tolerance=2,y_tolerance=3) or ''
            pages.append(text)
            if (i+1)%50==0: print(f'Extracted {i+1}/{len(pdf.pages)} pages',flush=True)
    cache.write_text(json.dumps(pages,ensure_ascii=False),encoding='utf-8')

offsets=[]; combined=''
for number,text in enumerate(pages,1):
    offsets.append((len(combined),number))
    text=re.sub(r'Page\s+\d+\s*\|[^\n]*','',text)
    combined+=text+'\n'
unit_marks=list(re.finditer(r'Unit\s+(\d+):\s*([^\n]+)',combined))
book=[]; rejects=[]
for i,u in enumerate(unit_marks):
    chunk=combined[u.end():unit_marks[i+1].start() if i+1<len(unit_marks) else len(combined)]
    starts=list(re.finditer(r'Q\.\s*(\d+)\.',chunk))
    for n,start in enumerate(starts):
        block=chunk[start.end():starts[n+1].start() if n+1<len(starts) else len(chunk)]
        qid=f'U{int(u.group(1)):02d}-Q{int(start.group(1)):03d}'
        answer=re.search(r'(?im)^Answer\s*:\s*\(([1-4])\)\s*([^\n]*)',block)
        explanation=re.search(r'(?im)^Explanation\s*:\s*',block)
        if not answer or not explanation or explanation.start()<answer.end():
            rejects.append({'id':qid,'reason':'Missing or irregular answer/explanation'}); continue
        first=block[:answer.start()]
        opts=list(re.finditer(r'(?m)^\s*\(([1-4])\)\s*',first))
        if len(opts)!=4 or [m.group(1) for m in opts]!=list('1234'):
            rejects.append({'id':qid,'reason':'Options need visual transcription'}); continue
        question=first[:opts[0].start()].strip()
        options=[first[m.end():opts[j+1].start() if j<3 else len(first)].strip() for j,m in enumerate(opts)]
        expl=block[explanation.end():]
        expl=re.split(r'(?im)^Source\s*:',expl)[0].strip()
        # Do not score items whose own explanation announces uncertainty.
        if re.search(r'(?i)most likely|ambiguous|question.{0,15}incorrect|disputed|intended answer',expl):
            rejects.append({'id':qid,'reason':'Uncertain answer in book explanation'}); continue
        if len(question)<20 or len(expl)<40 or any(not x for x in options):
            rejects.append({'id':qid,'reason':'Incomplete text'}); continue
        absolute=u.end()+start.start()
        page=max((p for off,p in offsets if off<=absolute),default=1)
        before=chunk[max(0,start.start()-150):start.start()]
        sources=re.findall(r'Source\s*:\s*([^\n]+)',before)
        book.append({'id':qid,'unit_number':int(u.group(1)), 'unit':u.group(2).strip(),
            'page':page,'source_claim':sources[-1].strip() if sources else 'Source label unavailable',
            'question_en':question,'options_en':options,'correct_index':int(answer.group(1))-1,'explanation_en':expl})

units=[
('Political Theory',[
'Liberty, equality and justice; negative and positive liberty; equality of opportunity',
'Rights, citizenship and political obligation; civil, political and social citizenship',
'Democracy: representative, participatory, deliberative and pluralist models',
'Power, authority, legitimacy and sovereignty; Weber and theories of power',
'Liberalism, classical and welfare liberalism; rights and the limits of the state',
'Conservatism, socialism and Marxism; reform, revolution and class',
'Feminist traditions; liberal, socialist and radical feminism; public/private divide',
'Ecologism, multiculturalism and recognition; anthropocentrism and deep ecology',
'Modern and postmodern political theory; decline and revival; fact/value debate',
'Behaviouralism, post-behaviouralism, systems and structural functional approaches',
'Contemporary justice debates: Rawls, Nozick, communitarian critiques and capabilities',
'Integrated advanced political theory: conceptual distinctions and normative applications']),
('Political Thought',[
'Confucius, Plato and Aristotle: virtue, justice, constitutions and citizenship',
'Plato and Aristotle: texts, education, ideal states and constitutional change',
'Machiavelli: republicanism, political necessity and political writings',
'Hobbes and Locke: consent, natural rights, contracts and sovereignty',
'Rousseau: general will, inequality, freedom and the social contract',
'Hegel and idealism: civil society, state, freedom; T. H. Green as a state-exam extension',
'Mary Wollstonecraft and J. S. Mill: equality, liberty and representative government',
'Marx: historical materialism, alienation, class, state and political economy',
'Gramsci: hegemony, civil society, intellectuals and the integral state',
'Hannah Arendt: action, public realm, totalitarianism and power/violence distinction',
'Fanon and Mao: colonialism, liberation, revolution and contradictions',
'Rawls: justice as fairness, original position, basic liberties and difference principle',
'State-exam extensions: Cicero, Aquinas, Bentham, Nozick and Habermas; established works only',
'Comparative thinkers: conceptual distinctions and verified chronology of major works']),
('Indian Political Thought',[
'Dharamshastra, Kautilya and Aggannasutta; ancient political traditions',
'Kautilya: state, administration, diplomacy, saptanga and mandala',
'Barani, Kabir and medieval political/social thought',
'Pandita Ramabai, Vivekananda and social reform; gender and caste',
'Tilak, Tagore and Aurobindo: nationalism, freedom and spirituality',
'Gandhi: satyagraha, swaraj, trusteeship, nonviolence and means/ends',
'Ambedkar: caste, constitutionalism, representation and social democracy',
'Nehru: secularism, democracy, planning and internationalism',
'Periyar, Iqbal and Savarkar: distinct ideas, texts and political projects',
'M. N. Roy, Lohia and Jayaprakash Narayan: humanism, socialism and total revolution',
'Deendayal Upadhyaya and state-exam reformer extensions: Rammohan Roy, Naoroji, Gokhale',
'Comparative Indian thinkers: equality, nationalism, democracy and political methods']),
('Comparative Political Analysis',[
'Comparative methods: institutionalism, new institutionalism, most-similar and most-different designs',
'Political culture and socialization: Almond, Verba, Pye and comparative frameworks',
'Political economy, capitalist/socialist states, welfare and postcolonial state theories',
'Colonialism, decolonization and European/non-European nationalisms',
'Democratic and authoritarian regimes: majoritarian, participatory, patrimonial and totalitarian',
'Constitutionalism, rule of law, judiciary, emergencies and constitutional crises',
'Democratic transitions and consolidation; Huntington and established comparative scholarship',
'Modernization, dependency and world-systems theories; development and democracy',
'Ruling classes, elites and democratic elitism: Mosca, Pareto, Michels and Mills',
'Electoral systems, parties, party systems and interest groups',
'Civil society, revolutions, NGOs and old/new social movements',
'State-exam constitutional comparison: UK, USA, France, China and Canada; stable institutional facts']),
('International Relations',[
'Idealism, classical realism and neorealism: thinkers and core assumptions',
'Neoliberal institutionalism and interdependence; Keohane and Nye',
'Marxist and critical IR: dependency, world systems and critical theory',
'Constructivism, feminism and postmodern IR: identity, norms, gender and discourse',
'Sovereignty, state systems, nonstate actors, national interest and power',
'Traditional/nontraditional security; human security and security dilemmas',
'War, deterrence, nuclear doctrines, disarmament and arms-control treaties',
'Conflict resolution, conflict transformation, peace research and positive/negative peace',
'United Nations: principal organs, functions, peacekeeping and reform debates',
'International law, International Court of Justice and International Criminal Court distinctions',
'Bretton Woods, IMF, World Bank, WTO and North-South political economy',
'Regional organizations: EU, AU, ASEAN and SCO; founding treaties and functions',
'BRICS, G20, global governance and South-South cooperation; historical rather than changing membership',
'Human rights, migration, refugees, terrorism and global environmental governance',
'Cold War and changing world order: historical events and analytical concepts; no unverified current claims']),
("India's Foreign Policy",[
'Foundations: principles, determinants, postcolonial identity and strategic autonomy',
'Nonalignment: origins, summits, leaders, principles and critical interpretations',
'India nuclear policy: historical milestones, doctrine and disarmament positions',
'India-USA relations: established turning points, agreements and analytical debates',
'India-USSR/Russia relations: historical treaties and strategic relations',
'India-China relations: Panchsheel, boundary question and historical turning points',
'India and South Asian neighbours: SAARC, Gujral Doctrine and bilateral policy',
'Look East/Act East and India-ASEAN relations: chronology and objectives',
'India and West Asia, Africa and the Indian diaspora: stable policy frameworks',
'India and EU, BRICS, SCO and multilateral diplomacy; historical foundations',
'India at UN, WTO, IMF and climate negotiations: positions and institutional roles',
'Maritime, energy, environmental, cyber and water security: foreign-policy applications']),
('Political Institutions in India',[
'Constitution making: colonial heritage, national movement and Constituent Assembly',
'Preamble, constitutional philosophy, citizenship and fundamental duties',
'Fundamental Rights: scope, protections and established constitutional interpretations',
'Directive Principles and their relationship with rights and welfare commitments',
'Amendment procedures, basic structure and constitutional judicial decisions',
'President, vice-president and prime minister: powers and parliamentary executive',
'Council of Ministers: collective responsibility, cabinet and executive-legislative relations',
'Parliament: composition, legislative procedure and financial legislation',
'Parliamentary committees, privileges and legislative accountability',
'Supreme Court, High Courts, judicial review, activism and independence',
'Governor, chief minister and state legislatures: constitutional roles',
'Federalism: centre-state legislative, administrative and financial relations',
'Asymmetric federalism, intergovernmental coordination and constitutional emergency provisions',
'Election Commission, electoral process, representation and established electoral reforms',
'Local government and constitutional/statutory bodies: 73rd/74th amendments, CAG and commissions']),
('Political Processes in India',[
'Nature of the Indian state, development planning and political economy',
'Economic reforms, globalization, growth and human development',
'Caste, religion, ethnicity, tribe, language and regional identities',
'Dalit, tribal and backward-class movements: concepts and established histories',
'Women movements, gender, equality and political representation',
'Farmers and labour movements: established organizations and political demands',
'Civil society, NGOs and nonparty political formations',
'State reorganization, regionalism, substate regions and demands for autonomy',
'National/regional parties: ideological/social bases and party-system changes',
'Electoral participation, representation, voting behaviour and democratic competition',
'State-exam extensions: Indian politics scholarship, coalitions, state politics and political movements']),
('Public Administration',[
'Meaning, evolution, public/private administration and politics-administration relationship',
'Scientific management, administrative management, organization principles and bureaucracy',
'Human relations, informal organization and behavioural approaches',
'Systems, decision-making, bounded rationality and ecological approaches',
'Development administration and comparative public administration',
'New Public Administration, social equity and Minnowbrook',
'New Public Management, public choice and reforms under liberalization',
'Leadership and motivation theories: Maslow, Herzberg, McGregor and established models',
'Organizational communication, Barnard, information and coordination',
'Follett, conflict management, integration and management by objectives',
'Integrated organizational theory, accountability, administrative ethics and governance applications']),
('Governance and Public Policy in India',[
'Governance, good governance, democratic governance and civil society',
'Accountability: legislative, executive, budgetary and judicial control',
'Administrative reforms, administrative culture, integrity and corruption',
'RTI, citizen charters, consumer protection and grievance redress: stable legal foundations',
'Ombudsman, Lokpal and Lokayukta: origins, functions and institutional distinctions',
'Panchayati Raj, decentralized planning and participatory governance',
'Sustainable development, e-governance and digital public-service concepts',
'Planning institutions and NITI Aayog: origin, structure and role distinctions',
'Public policy cycle: agenda, formulation, implementation and evaluation',
'Health, education, food security and employment policy: historical policy design; avoid unsupported current amendments',
'Social audit, jansunwai, monitoring, policy evaluation and citizen accountability'])
]
assert sum(len(topics) for _,topics in units)==125
canonical_units=['Political Theory','Western Political Thought','Indian Political Thought','Comparative Politics','International Relations',"India's Foreign Policy",'Political Institutions','Political Processes','Public Administration','Governance']
unique=[]; seen_stems=set()
for question in book:
    stem=re.sub(r'[^a-z0-9]','',question['question_en'].lower())
    if stem in seen_stems:
        rejects.append({'id':question['id'],'reason':'Repeated English stem'}); continue
    seen_stems.add(stem)
    question['unit']=units[question['unit_number']-1][0]
    unique.append(question)
book=unique
plan=[]; picked=set(); number=0
for unit_num,(unit,topics) in enumerate(units,1):
    pool=[q for q in book if q['unit_number']==unit_num]
    if len(pool)<len(topics)*4: raise ValueError(f'Unit {unit_num}: insufficient complete book questions ({len(pool)})')
    for order,topic in enumerate(topics,1):
        words=set(re.findall(r'[a-z]{4,}',topic.lower()))
        available=[q for q in pool if q['id'] not in picked]
        available.sort(key=lambda q:(-len(words & set(re.findall(r'[a-z]{4,}',q['question_en'].lower()))),q['id']))
        chosen=available[:4]; picked.update(q['id'] for q in chosen); number+=1
        plan.append({'test_number':number,'unit_number':unit_num,'unit':unit,'website_unit':canonical_units[unit_num-1],'test_in_unit':order,'focus':topic,
            'title':f'{unit} - Practice {order:02d}', 'book_questions':chosen,'original_count':16,'total_count':20})
(out/'book-question-pool.json').write_text(json.dumps(book,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'extraction-rejects.json').write_text(json.dumps(rejects,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'series-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'usable_book_candidates':len(book),'rejected_for_structure_or_uncertainty':len(rejects),'planned_tests':len(plan),'selected_book_questions':len(picked)},ensure_ascii=False),flush=True)

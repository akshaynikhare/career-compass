import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');

const { items: professions } = JSON.parse(readFileSync(join(dataDir, 'professions.json'), 'utf8'));
const { edges } = JSON.parse(readFileSync(join(dataDir, 'riasec_edges.json'), 'utf8'));

// Build RIASEC lookup by profession_id
const riasecMap = Object.fromEntries(edges.map(e => [e.profession_id, e]));

const CATEGORY_TAGS = {
  'Healthcare':                   ['healthcare'],
  'Technology':                   ['tech'],
  'Engineering':                  ['engineering'],
  'Arts & Media':                 ['creative', 'arts'],
  'Science & Research':           ['research', 'science'],
  'Finance & Business':           ['business', 'finance'],
  'Finance — Specialized Niche':  ['finance', 'specialized'],
  'Education':                    ['education'],
  'Law & Government':             ['legal', 'governance'],
  'Agriculture & Environment':    ['agriculture', 'environment'],
  'Social & Welfare':             ['social', 'welfare'],
  'Sports & Fitness':             ['sports', 'fitness'],
  'Hospitality & Food':           ['hospitality'],
  'Transport & Logistics':        ['transport'],
  'Trades & Construction':        ['trades', 'construction'],
  'Architecture & Design':        ['architecture', 'design'],
  'Mental Health & Wellness':     ['mental_health', 'wellness'],
  'Public Health & Policy':       ['policy', 'healthcare'],
  'Niche & Emerging Professions': ['niche', 'emerging'],
};

function buildTags(p) {
  const tags = new Set();

  // 1. Category tags
  for (const t of (CATEGORY_TAGS[p.category] ?? [])) tags.add(t);

  // 2. RIASEC tags
  const edge = riasecMap[p.id];
  if (edge) {
    if (edge.R > 0.25) tags.add('hands_on');
    if (edge.I > 0.25) tags.add('analytical');
    if (edge.A > 0.20) tags.add('expressive');
    if (edge.S > 0.25) tags.add('people_focused');
    if (edge.E > 0.20) tags.add('entrepreneurial');
    if (edge.C > 0.20) tags.add('structured');
  }

  // 3. Practical tags
  if (p.exam_intensity === 3)           tags.add('competitive_exam');
  if (p.years_min >= 6)                 tags.add('long_study');
  if (p.salary_lpa?.senior >= 30)       tags.add('high_earning');
  if (p.streams?.includes('pcm'))       tags.add('pcm_stream');
  if (p.streams?.includes('pcb'))       tags.add('pcb_stream');
  if (p.streams?.includes('any'))       tags.add('any_stream');
  if (p.streams?.includes('commerce'))  tags.add('commerce_stream');
  if (p.streams?.includes('arts'))      tags.add('arts_stream');

  // 4. Sub-domain tags (substring match on lowercased name)
  const name = p.name.toLowerCase();

  if (['doctor','physician','surgeon','nurse','dentist','ward ','clinic','hospital ward','therapist'].some(k => name.includes(k)))
    tags.add('clinical');

  if (['research','scientist','lab tech','biolog','chemist','physicist','geolog','astrono'].some(k => name.includes(k)))
    tags.add('research_sub');

  if (['psycho','mental health','counsel','behav','psychiatr'].some(k => name.includes(k)))
    tags.add('mental_health_sub');

  if (['software','developer','programmer','web dev','app dev','frontend','backend','full stack','devops','mobile dev'].some(k => name.includes(k)))
    tags.add('software_sub');

  if (['data scientist','data analyst','machine learn','artificial intel',' ml ','deep learn','data engineer','business intel'].some(k => name.includes(k)))
    tags.add('data_sub');

  if (['ux ','ui ','user experience','product design','interface design'].some(k => name.includes(k)))
    tags.add('design_sub');

  if (['network','cybersecurity','cloud','infrastructure','embedded','hardware engineer','iot'].some(k => name.includes(k)))
    tags.add('infra_sub');

  if (['graphic','visual','illustrat','photo','video editor','animator','vfx','film'].some(k => name.includes(k)))
    tags.add('visual_sub');

  if (['writer','author','journalist','content','editor','copywriter','scriptwriter','blogger'].some(k => name.includes(k)))
    tags.add('written_sub');

  if (['actor','performer','musician','dancer','theater','theatre','singer','stand-up','voice actor'].some(k => name.includes(k)))
    tags.add('performing_sub');

  if (['teacher','professor','lecturer','trainer','educator','tutor'].some(k => name.includes(k)))
    tags.add('teaching_sub');

  if (['field','outdoor','forest','wildlife','marine biolog','geolog','survey','mining','farm','agricultural'].some(k => name.includes(k)))
    tags.add('field_work');

  if (['manager','director','executive','ceo','founder','entrepreneur','consultant','strategist'].some(k => name.includes(k)))
    tags.add('leadership_sub');

  if (['analyst','actuar','risk','portfolio','quant','fund manager','trader','investment','economist'].some(k => name.includes(k)))
    tags.add('finance_analytical');

  if (['lawyer','advocate','judge','legal','solicitor','barrister','notary'].some(k => name.includes(k)))
    tags.add('legal_sub');

  if (['ias','ips','upsc','civil serv','diplomat','policy','govern','public admin'].some(k => name.includes(k)))
    tags.add('policy_sub');

  if (['cardio','neuro','ortho','pediatr','oncolog','radiol','anaesth','ophthal','dermat','gynae','urolog','endocrin','gastro','patholog'].some(k => name.includes(k)))
    tags.add('specialist_medical');

  return [...tags];
}

const result = {};
for (const p of professions) {
  result[p.id] = buildTags(p);
}

writeFileSync(join(dataDir, 'profession_tags.json'), JSON.stringify(result, null, 2));
console.log(`Done. Tagged ${Object.keys(result).length} professions.`);

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");

const { items: professions } = JSON.parse(readFileSync(join(dataDir, "professions.json"), "utf8"));
const { edges } = JSON.parse(readFileSync(join(dataDir, "riasec_edges.json"), "utf8"));

const riasecMap = {};
for (const edge of edges) {
  riasecMap[edge.profession_id] = edge;
}

const CATEGORY_TAGS = {
  "Healthcare":                   ["healthcare"],
  "Technology":                   ["tech"],
  "Engineering":                  ["engineering"],
  "Arts & Media":                 ["creative", "arts"],
  "Science & Research":           ["research", "science"],
  "Finance & Business":           ["business", "finance"],
  "Finance — Specialized Niche":  ["finance", "specialized"],
  "Education":                    ["education"],
  "Law & Government":             ["legal", "governance"],
  "Agriculture & Environment":    ["agriculture", "environment"],
  "Social & Welfare":             ["social", "welfare"],
  "Sports & Fitness":             ["sports", "fitness"],
  "Hospitality & Food":           ["hospitality"],
  "Transport & Logistics":        ["transport"],
  "Trades & Construction":        ["trades", "construction"],
  "Architecture & Design":        ["architecture", "design"],
  "Mental Health & Wellness":     ["mental_health", "wellness"],
  "Public Health & Policy":       ["policy", "healthcare"],
  "Niche & Emerging Professions": ["niche", "emerging"],
};

function buildTags(profession) {
  const tags = new Set();

  // Category tags
  const catTags = CATEGORY_TAGS[profession.category] || [];
  for (const t of catTags) tags.add(t);

  // RIASEC tags
  const edge = riasecMap[profession.id];
  if (edge) {
    if (edge.R > 0.25) tags.add("hands_on");
    if (edge.I > 0.25) tags.add("analytical");
    if (edge.A > 0.20) tags.add("expressive");
    if (edge.S > 0.25) tags.add("people_focused");
    if (edge.E > 0.20) tags.add("entrepreneurial");
    if (edge.C > 0.20) tags.add("structured");
  }

  // Practical tags
  if (profession.exam_intensity === 3) tags.add("competitive_exam");
  if (profession.years_min >= 6) tags.add("long_study");
  if (profession.salary_lpa?.senior >= 30) tags.add("high_earning");
  if (profession.streams?.includes("pcm")) tags.add("pcm_stream");
  if (profession.streams?.includes("pcb")) tags.add("pcb_stream");
  if (profession.streams?.includes("any")) tags.add("any_stream");
  if (profession.streams?.includes("commerce")) tags.add("commerce_stream");
  if (profession.streams?.includes("arts")) tags.add("arts_stream");

  // Sub-domain tags
  const name = profession.name.toLowerCase();

  if (["doctor","physician","surgeon","nurse","dentist","ward","clinic","hospital","therapist"].some(k => name.includes(k)))
    tags.add("clinical");

  if (["research","scientist","lab","biolog","chemist","physicist","geolog","astrono"].some(k => name.includes(k)))
    tags.add("research_sub");

  if (["psycho","mental","counsel","behav","psychiatr"].some(k => name.includes(k)))
    tags.add("mental_health_sub");

  if (["software","developer","programmer","web dev","app dev","frontend","backend","full stack","devops","mobile dev"].some(k => name.includes(k)))
    tags.add("software_sub");

  if (["data","machine learn","artificial intel","ml ","deep learn","analytics","statistic"].some(k => name.includes(k)))
    tags.add("data_sub");

  if (["ux","ui ","user experience","product design","interface"].some(k => name.includes(k)))
    tags.add("design_sub");

  if (["network","security","cloud","infrastructure","embedded","hardware","iot"].some(k => name.includes(k)))
    tags.add("infra_sub");

  if (["graphic","visual","illustrat","photo","video","animator","film"].some(k => name.includes(k)))
    tags.add("visual_sub");

  if (["writer","author","journalist","content","editor","copywriter","scriptwriter"].some(k => name.includes(k)))
    tags.add("written_sub");

  if (["actor","performer","musician","dancer","theater","theatre","singer","stand-up"].some(k => name.includes(k)))
    tags.add("performing_sub");

  if (["teacher","professor","lecturer","trainer","educator","tutor"].some(k => name.includes(k)))
    tags.add("teaching_sub");

  if (["field","outdoor","forest","wildlife","marine","geolog","survey","mining","agriculture","farm"].some(k => name.includes(k)))
    tags.add("field_work");

  if (["manager","director","executive","ceo","founder","entrepreneur","consultant","strategy"].some(k => name.includes(k)))
    tags.add("leadership_sub");

  if (["analyst","actuar","risk","portfolio","quant","fund","trader","invest","economist"].some(k => name.includes(k)))
    tags.add("finance_analytical");

  if (["lawyer","advocate","judge","legal","solicitor","barrister","notary"].some(k => name.includes(k)))
    tags.add("legal_sub");

  if (["ias","ips","upsc","civil serv","diplomat","policy","govern","admin"].some(k => name.includes(k)))
    tags.add("policy_sub");

  if (["cardio","neuro","ortho","pediatr","oncolog","radiol","anaesth","ophthal","dermat","gynae","urolog","endocrin","gastro"].some(k => name.includes(k)))
    tags.add("specialist_medical");

  return Array.from(tags);
}

const result = {};
for (const profession of professions) {
  result[profession.id] = buildTags(profession);
}

writeFileSync(join(dataDir, "profession_tags.json"), JSON.stringify(result, null, 2));
console.log(`Done. Tagged ${Object.keys(result).length} professions.`);

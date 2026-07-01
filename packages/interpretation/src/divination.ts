/**
 * ศาสตร์เสริม 4 อย่าง จากวัน/เดือน/ปีเกิด (ไม่ใช้เวลาเกิด)
 *   1) ทักษา (มหาทักษา) — จากวันเกิด → ดาวเกาะเรือน 8 + กาลกิณี + สีมงคล/สีต้องห้าม
 *   2) ราศีสุริยคติ      — จากวันที่+เดือน → 12 ราศี + ธาตุ + ดาวเจ้าเรือน
 *   3) เลขศาสตร์         — ผลรวมเลขวัน/เดือน/ปีเกิด → รากเลข 1–9 (แยกรายคน)
 *   4) ปีชง             — นักษัตรเกิด เทียบ นักษัตรปีที่ดู → ชงตรง/ชงร่วม
 */

// ───────────────────────── 1) ทักษา (มหาทักษา) ─────────────────────────
// ลำดับเดินดาวทักษา (อัฐเคราะห์): อา จ อ พ ส พฤ ราหู ศ
const TAKSA_WALK = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "เสาร์", "พฤหัสบดี", "ราหู", "ศุกร์"];
// weekday 0..6 (อา..เสาร์) → ตำแหน่งในลำดับเดินทักษา
const WEEKDAY_TO_WALK = [0, 1, 2, 3, 5, 7, 4];
// เรือนทักษา 8 (บริวาร = ดาวเจ้าวันเกิด แล้วไล่ไป)
const TAKSA_HOUSES = [
  { name: "บริวาร", meaning: "ลูกน้อง ผู้ติดตาม คนรอบข้าง" },
  { name: "อายุ", meaning: "สุขภาพ การดำเนินชีวิต" },
  { name: "เดช", meaning: "อำนาจ บารมี ความเด่นดัง" },
  { name: "ศรี", meaning: "สิริมงคล เสน่ห์ โชคลาภ ทรัพย์" },
  { name: "มูละ", meaning: "หลักทรัพย์ ฐานะ ที่ดิน มรดก" },
  { name: "อุตสาหะ", meaning: "ความเพียร การงาน ความสำเร็จ" },
  { name: "มนตรี", meaning: "ผู้ใหญ่อุปถัมภ์ ที่ปรึกษา" },
  { name: "กาลกิณี", meaning: "อัปมงคล สิ่งที่ควรหลีกเลี่ยง" },
];
const PLANET_COLOR: Record<string, string> = {
  อาทิตย์: "แดง", จันทร์: "ขาว/ครีม/เหลืองอ่อน", อังคาร: "ชมพู/ส้ม", พุธ: "เขียว",
  พฤหัสบดี: "เหลือง/ส้ม", ศุกร์: "ฟ้า/น้ำเงิน", เสาร์: "ดำ/ม่วง", ราหู: "เทา/ดำ/รุ้ง",
};

export interface TaksaHouse { house: string; planet: string; color: string; meaning: string; }
export interface TaksaReading {
  birthPlanet: string;
  houses: TaksaHouse[];
  kalakiniPlanet: string; avoidColor: string; // กาลกิณี → สีต้องห้าม
  sriPlanet: string; luckColor: string;       // ศรี → สีเสริมโชค/เสน่ห์
  dechPlanet: string; powerColor: string;     // เดช → สีเสริมอำนาจ
}

/** ทักษาจากวันเกิด (weekday 0=อาทิตย์..6=เสาร์) — พุธใช้พุธกลางวัน */
export function interpretTaksa(weekday: number): TaksaReading {
  const start = WEEKDAY_TO_WALK[((weekday % 7) + 7) % 7]!;
  const houses: TaksaHouse[] = TAKSA_HOUSES.map((h, k) => {
    const planet = TAKSA_WALK[(start + k) % 8]!;
    return { house: h.name, planet, color: PLANET_COLOR[planet] ?? "", meaning: h.meaning };
  });
  const find = (name: string) => houses.find((h) => h.house === name)!;
  const kala = find("กาลกิณี"), sri = find("ศรี"), dech = find("เดช");
  return {
    birthPlanet: houses[0]!.planet,
    houses,
    kalakiniPlanet: kala.planet, avoidColor: kala.color,
    sriPlanet: sri.planet, luckColor: sri.color,
    dechPlanet: dech.planet, powerColor: dech.color,
  };
}

// ───────────────────────── 2) ราศีสุริยคติ ─────────────────────────
// ขอบเขตราศีไทย (สุริยคติ/นิรายนะ) — เริ่มแต่ละราศีที่ (เดือน, วันที่)  *±1 วันแล้วแต่ตำรา
const RASI = [
  { name: "เมษ", from: [4, 13], element: "ไฟ", ruler: "อังคาร", text: "ผู้นำ กล้าหาญ ใจร้อน บุกตะลุย ริเริ่มเก่ง" },
  { name: "พฤษภ", from: [5, 15], element: "ดิน", ruler: "ศุกร์", text: "หนักแน่น รักความมั่นคง รักสวยรักงาม อดทน" },
  { name: "เมถุน", from: [6, 15], element: "ลม", ruler: "พุธ", text: "ช่างพูด ไหวพริบดี ปรับตัวเก่ง รักอิสระ" },
  { name: "กรกฎ", from: [7, 15], element: "น้ำ", ruler: "จันทร์", text: "อ่อนไหว รักครอบครัว ใจดี ขี้กังวล" },
  { name: "สิงห์", from: [8, 17], element: "ไฟ", ruler: "อาทิตย์", text: "เชื่อมั่น สง่า รักเกียรติ ใจกว้าง ชอบเป็นที่หนึ่ง" },
  { name: "กันย์", from: [9, 17], element: "ดิน", ruler: "พุธ", text: "ละเอียด เจ้าระเบียบ ช่างวิเคราะห์ พิถีพิถัน" },
  { name: "ตุล", from: [10, 17], element: "ลม", ruler: "ศุกร์", text: "รักความยุติธรรม ประนีประนอม มีเสน่ห์ รักสังคม" },
  { name: "พิจิก", from: [11, 16], element: "น้ำ", ruler: "อังคาร", text: "ลึกลับ มุ่งมั่น จริงจัง อารมณ์รุนแรง รักเดียว" },
  { name: "ธนู", from: [12, 16], element: "ไฟ", ruler: "พฤหัสบดี", text: "รักอิสระ มองโลกกว้าง ตรงไปตรงมา ชอบผจญภัย" },
  { name: "มกร", from: [1, 15], element: "ดิน", ruler: "เสาร์", text: "ทะเยอทะยาน อดทน รับผิดชอบ มุ่งความสำเร็จ" },
  { name: "กุมภ์", from: [2, 13], element: "ลม", ruler: "เสาร์", text: "หัวก้าวหน้า มีอุดมการณ์ รักเพื่อน คิดนอกกรอบ" },
  { name: "มีน", from: [3, 15], element: "น้ำ", ruler: "พฤหัสบดี", text: "อ่อนโยน เพ้อฝัน เมตตา ศิลปิน จิตใจดี" },
];
export interface RasiReading { name: string; element: string; ruler: string; text: string; }

/** ราศีเกิด จากวันที่+เดือนสุริยคติ (เลือกตามเส้นแบ่งวันที่ ไล่จากปลายปี) */
export function interpretRasi(month: number, day: number): RasiReading {
  const k = month * 100 + day;
  const bounds: [number, string][] = [
    [1216, "ธนู"], [1116, "พิจิก"], [1017, "ตุล"], [917, "กันย์"], [817, "สิงห์"],
    [715, "กรกฎ"], [615, "เมถุน"], [515, "พฤษภ"], [413, "เมษ"], [315, "มีน"], [213, "กุมภ์"], [115, "มกร"],
  ];
  let name = "ธนู"; // ก่อน 15 ม.ค. = ธนู (ต่อจากปลายปีก่อน)
  for (const [key, nm] of bounds) { if (k >= key) { name = nm; break; } }
  const r = RASI.find((x) => x.name === name)!;
  return { name: r.name, element: r.element, ruler: r.ruler, text: r.text };
}

// ───────────────────────── 3) เลขศาสตร์ (ผลรวมวันเดือนปีเกิด) ─────────────────────────
const NUM_ROOT_TEXT: Record<number, string> = {
  1: "ผู้นำ เป็นตัวของตัวเอง ทะเยอทะยาน ริเริ่ม ชอบอิสระในการตัดสินใจ",
  2: "ประนีประนอม อ่อนโยน รักความสัมพันธ์/คู่ ทำงานเป็นทีมได้ดี",
  3: "ช่างสื่อสาร ความคิดสร้างสรรค์ ร่าเริง มีเสน่ห์ มองโลกบวก",
  4: "มั่นคง ขยัน มีระเบียบ อดทน รากฐานแน่น แต่ยืดหยุ่นน้อย",
  5: "รักอิสระ ชอบเปลี่ยนแปลง การเดินทาง ปรับตัวไว เบื่อง่าย",
  6: "รักครอบครัว รับผิดชอบ เมตตา รักศิลปะ ดูแลคนรอบข้าง",
  7: "ปัญญาลึก ช่างค้นคว้า จิตวิญญาณ ชอบสันโดษ วิเคราะห์เก่ง",
  8: "อำนาจ การเงิน ธุรกิจ ความสำเร็จทางวัตถุ ทะเยอทะยานสูง",
  9: "เมตตากรุณา เสียสละ อุดมคติ มองภาพใหญ่ ปิดจบรอบเพื่อเริ่มใหม่",
};
export interface NumerologyReading { sum: number; root: number; text: string; }

/** เลขศาสตร์: ผลรวมเลขทุกหลักของ วัน+เดือน+ปี(พ.ศ.) → รากเลข 1–9 */
export function interpretNumerology(day: number, month: number, beYear: number): NumerologyReading {
  const digits = `${day}${month}${beYear}`.split("").reduce((a, c) => a + Number(c), 0);
  let root = digits;
  while (root > 9) root = String(root).split("").reduce((a, c) => a + Number(c), 0);
  return { sum: digits, root, text: NUM_ROOT_TEXT[root] ?? "" };
}

// ───────────────────────── 4) ปีชง ─────────────────────────
const NAK_NAMES = ["", "ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง", "มะเมีย", "มะแม", "วอก", "ระกา", "จอ", "กุน"];
export interface ChongReading {
  status: "ชงตรง" | "ชงร่วม" | "ปีเกิด (คาบเกี่ยว)" | "ไม่ชง";
  birthNak: string; yearNak: string; text: string;
}

/** ปีชง: นักษัตรเกิด (1..12) เทียบ นักษัตรปีที่ดู (1..12) */
export function interpretChong(birthNaksatr: number, yearNaksatr: number): ChongReading {
  const diff = (((birthNaksatr - yearNaksatr) % 12) + 12) % 12;
  const birthNak = NAK_NAMES[birthNaksatr] ?? "", yearNak = NAK_NAMES[yearNaksatr] ?? "";
  let status: ChongReading["status"], text: string;
  if (diff === 6) { status = "ชงตรง"; text = `ปี${yearNak}ชงกับปี${birthNak}แบบ "ชงตรง" (หนักสุด) — ระวังอุปสรรค การเงิน สุขภาพ ควรทำบุญ/แก้ชง ตั้งสติก่อนตัดสินใจใหญ่`; }
  else if (diff === 0) { status = "ปีเกิด (คาบเกี่ยว)"; text = `ปีนี้เป็นปีนักษัตรเดียวกับปีเกิด (คาบเกี่ยว/ชงตัวเอง) — มีการเปลี่ยนแปลง ควรไม่ประมาท เสริมดวงไว้ดี`; }
  else if (diff === 3 || diff === 9) { status = "ชงร่วม"; text = `ปี${yearNak}ชงกับปี${birthNak}แบบ "ชงร่วม" (รองลงมา) — มีเรื่องกวนใจบ้าง ระวังคำพูด/สัญญา ทำบุญเสริมดวง`; }
  else { status = "ไม่ชง"; text = `ปี${yearNak}ไม่ชงกับปี${birthNak} — เป็นปีปกติ ดำเนินชีวิตได้ตามจังหวะดวงประจำปี`; }
  return { status, birthNak, yearNak, text };
}

// ───────────────────────── 5) ธาตุประจำตัว (วัน×ปี / เดือน×ปี) ─────────────────────────
// ธาตุปีนักษัตร (ตามกิ่งจีน 5 ธาตุ) — index = นักษัตร 1..12 (ชวด=1)
const NAK_ELEMENT = ["", "น้ำ", "ดิน", "ไม้", "ไม้", "ดิน", "ไฟ", "ไฟ", "ดิน", "ทอง", "ทอง", "ดิน", "น้ำ"];
const ELEM_TRAIT: Record<string, string> = {
  ไฟ: "ร้อนแรง ใจเร็ว มุ่งมั่น กล้าได้กล้าเสีย",
  ดิน: "หนักแน่น มั่นคง อดทน เชื่อถือได้",
  ลม: "คล่องแคล่ว ช่างคิด สื่อสารเก่ง รักอิสระ",
  น้ำ: "อ่อนไหว ลึกซึ้ง ปรับตัวเก่ง เมตตา",
  ไม้: "เติบโต ยืดหยุ่น มีเมตตา ใฝ่เรียนรู้",
  ทอง: "เด็ดขาด มีระเบียบ แข็งแกร่ง รักความถูกต้อง",
};
export interface ElementProfile {
  rasiElement: string; yearElement: string; dayPlanet: string; text: string;
}
/** ธาตุประจำตัว = ธาตุราศี(เดือน/วัน) ผสาน ธาตุปีนักษัตร(ปี) + ดาวเจ้าวันเกิด */
export function interpretElementProfile(rasiElement: string, naksatr: number, dayPlanet: string): ElementProfile {
  const yearElement = NAK_ELEMENT[naksatr] ?? "";
  const text =
    `ธาตุราศี ${rasiElement} (${ELEM_TRAIT[rasiElement] ?? ""}) ` +
    `ผสานธาตุปีนักษัตร ${yearElement} (${ELEM_TRAIT[yearElement] ?? ""}) ` +
    `โดยมีดาวเจ้าวันเกิดคือ ${dayPlanet} เป็นแรงขับเบื้องหลัง`;
  return { rasiElement, yearElement, dayPlanet, text };
}

// ───────────────────────── 6) คู่สมพงษ์ (เทียบ 2 คน) ─────────────────────────
// ลิ่วฮะ (คู่มิตรลับ) — คู่ของกิ่ง (นักษัตร-1): ชวด-ฉลู, ขาล-กุน, เถาะ-จอ, มะโรง-ระกา, มะเส็ง-วอก, มะเมีย-มะแม
const LIUHE = new Set(["0,1", "2,11", "3,10", "4,9", "5,8", "6,7"]);
const DOW7 = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function nakRelation(na: number, nb: number): { rel: string; pts: number } {
  const diff = (((na - nb) % 12) + 12) % 12;
  if (diff === 6) return { rel: "ชง (ปะทะกัน)", pts: -3 };
  if (diff === 4 || diff === 8) return { rel: "สามฮะ (ส่งเสริมแรง)", pts: 3 };
  const key = [na - 1, nb - 1].sort((x, y) => x - y).join(",");
  if (LIUHE.has(key)) return { rel: "ลิ่วฮะ (คู่มิตรลับ)", pts: 3 };
  if (diff === 0) return { rel: "นักษัตรเดียวกัน", pts: 1 };
  return { rel: "เป็นกลาง", pts: 0 };
}
function elemRelation(ea: string, eb: string): { rel: string; pts: number } {
  if (ea === eb) return { rel: "ธาตุเดียวกัน เข้ากันดี", pts: 2 };
  const fireAir = new Set(["ไฟ", "ลม"]), earthWater = new Set(["ดิน", "น้ำ"]);
  if ((fireAir.has(ea) && fireAir.has(eb)) || (earthWater.has(ea) && earthWater.has(eb)))
    return { rel: "ธาตุส่งเสริมกัน", pts: 2 };
  return { rel: "ธาตุต่างขั้ว ต้องปรับเข้าหากัน", pts: -1 };
}

export interface Person { weekday: number; naksatr: number; naksatrName: string; rasiElement: string; }
export interface Compatibility {
  level: string; score: number; percent: number; emoji: string;
  naksatrRel: string; elementRel: string; weekdayRel: string; text: string;
}
/** คู่สมพงษ์: เทียบ 2 คน (นักษัตร + ธาตุราศี + วันเกิด) */
export function interpretCompatibility(a: Person, b: Person): Compatibility {
  const nr = nakRelation(a.naksatr, b.naksatr);
  const er = elemRelation(a.rasiElement, b.rasiElement);
  const sameDay = a.weekday === b.weekday;
  const score = nr.pts + er.pts + (sameDay ? 1 : 0);
  let level: string, emoji: string;
  if (nr.rel.startsWith("ชง")) { level = "ระวัง — มีจุดปะทะ ต้องเข้าใจกันมาก"; emoji = "⚠️"; }
  else if (score >= 4) { level = "สมพงษ์ดีมาก เนื้อคู่/หุ้นส่วนที่ดี"; emoji = "💕"; }
  else if (score >= 2) { level = "เข้ากันดี เสริมกันได้"; emoji = "💚"; }
  else if (score >= 0) { level = "ปานกลาง อยู่ที่การปรับตัว"; emoji = "💛"; }
  else { level = "ต้องปรับเข้าหากันมาก"; emoji = "🧡"; }
  const text =
    `นักษัตร ${a.naksatrName}–${b.naksatrName}: ${nr.rel} · ` +
    `ธาตุราศี ${a.rasiElement}–${b.rasiElement}: ${er.rel} · ` +
    `วันเกิด ${DOW7[a.weekday]}–${DOW7[b.weekday]}: ${sameDay ? "วันเดียวกัน (ใจตรงกัน)" : "ต่างวัน (เติมเต็มกัน)"}`;
  // แปลงคะแนนเป็น % สนุก ๆ (45–99) — score ~ -4..6
  const percent = Math.max(45, Math.min(99, Math.round(58 + score * 7)));
  return {
    level, score, percent, emoji,
    naksatrRel: nr.rel, elementRel: er.rel,
    weekdayRel: sameDay ? "วันเดียวกัน" : "ต่างวัน", text,
  };
}

// ───────────────────────── รวม 4 ศาสตร์ ─────────────────────────
export interface Divination {
  taksa: TaksaReading;
  rasi: RasiReading;
  numerology: NumerologyReading;
  chong: ChongReading;
  elementProfile: ElementProfile;
}
export function computeDivination(p: {
  weekday: number; month: number; day: number; beYear: number;
  birthNaksatr: number; viewNaksatr: number;
}): Divination {
  const taksa = interpretTaksa(p.weekday);
  const rasi = interpretRasi(p.month, p.day);
  return {
    taksa,
    rasi,
    numerology: interpretNumerology(p.day, p.month, p.beYear),
    chong: interpretChong(p.birthNaksatr, p.viewNaksatr),
    elementProfile: interpretElementProfile(rasi.element, p.birthNaksatr, taksa.birthPlanet),
  };
}

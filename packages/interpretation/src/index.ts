import type { YearPoint } from "@life-graph/types";
import {
  WEEKDAY_TEXT,
  PAIR_TEXT,
  LUNAR_MONTH_TEXT,
  LUNAR_MONTH_NAMES,
  YEARLY_POEM,
} from "./predictions-data.js";

export { WEEKDAY_TEXT, PAIR_TEXT, LUNAR_MONTH_TEXT, LUNAR_MONTH_NAMES, YEARLY_POEM };
export * from "./divination.js";

export interface YearlyTransit {
  age: number; // อายุปลายช่วงปีที่ทำนาย
  value: number; // เลขปีจร (เลขดวงของปีนั้น)
  house: string; // ภพที่ปีจรตก
  poem: string; // กลอนคำทำนายตามเลข
}

function transitAt(base12: number[], natal: HouseReading[], age: number): YearlyTransit {
  const r = ((age % 12) + 12) % 12;
  const value = base12[r] ?? 0;
  const houseNo = r === 0 ? 12 : r;
  const house = natal.find((h) => h.no === houseNo)?.name ?? "";
  return { age, value, house, poem: YEARLY_POEM[value] ?? "" };
}

/**
 * ดวงจรประจำปี: ไล่จากปีถัดไป (predictAge) ไปจนถึง "ปีที่ตกเลขดวงคู่สูงสุด"
 * (เลขดวงที่ซ้ำ ≥2 ภพ ค่ามากที่สุด) — ตามตำรา "นับจากวันจรถึงคู่สูงสุด"
 */
export function interpretYearlyTransits(
  base12: number[],
  natal: HouseReading[],
  predictAge: number
): YearlyTransit[] {
  const counts = new Map<number, number>();
  for (const v of base12) counts.set(v, (counts.get(v) ?? 0) + 1);
  const paired = [...counts.entries()].filter(([, c]) => c >= 2).map(([v]) => v);
  const target = paired.length ? Math.max(...paired) : null;

  const out: YearlyTransit[] = [];
  for (let age = predictAge; age <= predictAge + 12; age++) {
    const t = transitAt(base12, natal, age);
    out.push(t);
    if (target === null || t.value === target) break; // ถึงคู่สูงสุด → หยุด
  }
  return out;
}

/**
 * แปลงระดับเลขกราฟชีวิต (1..12, 12=ดีสุด) → ระดับ + คำทำนายสั้น ๆ
 * อิงหลัก myhora: "เลขสูงดีกว่าเลขต่ำ"
 */

export type Tier = "excellent" | "good" | "neutral" | "caution" | "difficult";

export interface YearInterpretation {
  year: number;
  age: number;
  score: number;
  tier: Tier;
  headline: string;
}

const TIER_TEXT: Record<Tier, string> = {
  excellent: "ปีทอง จังหวะชีวิตพุ่งสูง เหมาะริเริ่มสิ่งใหม่",
  good: "เกณฑ์ดี มีโอกาสและแรงหนุน ลงมือได้",
  neutral: "ทรงตัว เน้นรักษาสมดุล ไม่ประมาท",
  caution: "ควรระมัดระวัง วางแผนรอบคอบก่อนตัดสินใจ",
  difficult: "ปีท้าทาย ตั้งรับให้ดี หลีกเลี่ยงความเสี่ยงใหญ่",
};

/** ระดับเลข 1..12 → tier */
export function tierFromScore(score: number): Tier {
  if (score >= 11) return "excellent";
  if (score >= 9) return "good";
  if (score >= 6) return "neutral";
  if (score >= 4) return "caution";
  return "difficult";
}

export function interpretYear(point: YearPoint): YearInterpretation {
  const tier = tierFromScore(point.score);
  return {
    year: point.year,
    age: point.age,
    score: point.score,
    tier,
    headline: TIER_TEXT[tier],
  };
}

export function interpretSeries(points: YearPoint[]): YearInterpretation[] {
  return points.map(interpretYear);
}

// ---------------------------------------------------------------------------
// คำทำนายพื้นดวง 12 ภพ (natal) — ตามที่ myhora แสดงในส่วน "คำทำนายระดับเลข"
// ค่าแต่ละภพ = base12[houseNo % 12]  (วาสนา=base[1] ... วินาศ=base[0])
// ---------------------------------------------------------------------------

export interface House {
  no: number; // 1..12
  name: string; // ชื่อภพ (ที่ myhora ใช้)
  sanskrit: string; // ชื่อสันสกฤต
  meaning: string; // ความหมาย
}

/** 12 ภพ เรียงตามตำรา (ตนุ..วินาศ) ตรงกับ myhora */
export const HOUSES: readonly House[] = [
  { no: 1, name: "วาสนา", sanskrit: "ตนุ", meaning: "บุญกรรมที่ติดตัวมาแต่กำเนิด ตัวเรา" },
  { no: 2, name: "ทรัพย์", sanskrit: "กดุมภะ", meaning: "การเงิน รายได้ ความร่ำรวย ทรัพย์สิน ความรู้" },
  { no: 3, name: "เพื่อน", sanskrit: "สหัชชะ", meaning: "มิตร เพื่อนฝูง หุ้นส่วน เจ้านาย การเดินทาง สังคม" },
  { no: 4, name: "ญาติ", sanskrit: "พันธุ", meaning: "ญาติพี่น้อง พ่อแม่ บ้าน ที่อยู่อาศัย มรดก" },
  { no: 5, name: "บริวาร", sanskrit: "ปุตตะ", meaning: "บุตร ลูกหลาน ลูกน้อง การริเริ่มสิ่งใหม่" },
  { no: 6, name: "ศัตรู", sanskrit: "อริ", meaning: "อุปสรรค ความเหนื่อยยาก การขัดขวาง" },
  { no: 7, name: "คู่ครอง", sanskrit: "ปัตนิ", meaning: "สามี ภรรยา คู่ครอง ความรัก การแต่งงาน" },
  { no: 8, name: "โรคภัย", sanskrit: "มรณะ", meaning: "โรคประจำตัว ความเดือดร้อน ทุกข์ลาภ" },
  { no: 9, name: "ความสุข", sanskrit: "ศุภะ", meaning: "ความสำเร็จ ความก้าวหน้า เกียรติยศ ชื่อเสียง บารมี" },
  { no: 10, name: "การงาน", sanskrit: "กัมมะ", meaning: "งาน ภาระหน้าที่ อาชีพ ตำแหน่ง ผลประโยชน์" },
  { no: 11, name: "ลาภยศ", sanskrit: "ลาภะ", meaning: "โชคลาภ โอกาส สิ่งที่ได้มาง่าย ความเจริญรุ่งเรือง" },
  { no: 12, name: "วินาศ", sanskrit: "วินาศ", meaning: "ความเดือดร้อน สิ้นเปลือง ล้มเหลว ผิดหวัง การต่อสู้" },
];

export type Realm = "สวรรค์ภูมิ" | "มนุษย์ภูมิ" | "นรกภูมิ";

/** ระดับเลข → ภูมิ (ตามหลัก myhora: เลขสูง=สวรรค์, กลาง=มนุษย์, ต่ำ=นรก) */
export function realmFromValue(value: number): Realm {
  if (value >= 9) return "สวรรค์ภูมิ";
  if (value >= 5) return "มนุษย์ภูมิ";
  return "นรกภูมิ";
}

const REALM_TEXT: Record<Realm, string> = {
  สวรรค์ภูมิ: "อยู่ในเกณฑ์ดีมาก ส่งเสริมเรื่องนี้ให้รุ่งเรือง",
  มนุษย์ภูมิ: "อยู่ในเกณฑ์ปานกลาง พอไปได้ ใช้ความสามารถของตน",
  นรกภูมิ: "อยู่ในเกณฑ์ต่ำ ควรระมัดระวังและหมั่นสร้างเหตุที่ดี",
};

export interface HouseReading {
  no: number;
  name: string;
  meaning: string;
  value: number; // เลข 1..12 ของภพนี้
  realm: Realm;
  text: string;
}

/** คำทำนายพื้นดวง 12 ภพ จาก base12 (index = age mod 12) */
export function interpretNatal(base12: number[]): HouseReading[] {
  return HOUSES.map((h) => {
    const value = base12[h.no % 12] ?? 0; // วินาศ(12) → base[0]
    const realm = realmFromValue(value);
    return {
      no: h.no,
      name: h.name,
      meaning: h.meaning,
      value,
      realm,
      text: `${h.name} เลข ${value} — ${REALM_TEXT[realm]}`,
    };
  });
}

// ---------------------------------------------------------------------------
// ทำนายตรง — ภพที่ "ตกเลขเดียวกัน ≥2" สัมพันธ์กัน (ความสัมพันธ์จุดพยากรณ์)
// ---------------------------------------------------------------------------

export interface RepeatedPair {
  a: string;
  b: string;
  text: string | null; // คำทำนายคู่ (null ถ้ายังไม่มีในคลัง)
}
export interface RepeatedGroup {
  value: number; // เลขที่ซ้ำ
  houses: string[]; // ภพที่ตกเลขนี้
  pairs: RepeatedPair[];
}

// แม่แบบ "เลขสัมพันธ์" เลือกตาม "ค่าเลขที่ตกซ้ำ" (อิง mahamodo): 5–8 = ระวัง, ที่เหลือ = ดี
const REL_POSITIVE =
  "เรื่องเหล่านี้ส่งแรงถึงกันชัด หากเรื่องหนึ่งเดินดี อีกเรื่องมักได้รับผลดีตามไปด้วย " +
  "เหมาะกับการใช้จังหวะนี้สร้างความมั่นคงต่อเนื่อง";
const REL_CAUTION =
  "เรื่องเหล่านี้ผูกกันแรง ควรใช้ความรอบคอบเป็นพิเศษ " +
  "เมื่อดูแลจุดเสี่ยงได้ดี เรื่องที่เกี่ยวข้องกันจะเบาลงและกลับมาเป็นแรงหนุนได้";

/** คำทำนายคู่สำรอง (เมื่อไม่มีในคลัง myhora) — เลือกแม่แบบตามค่าเลข: 1–4 & 9–12 = ดี, 5–8 = ระวัง */
function relationFallback(value: number): string {
  return value >= 5 && value <= 8 ? REL_CAUTION : REL_POSITIVE;
}

/** หาภพที่ตกเลขเดียวกันตั้งแต่ 2 ภพขึ้นไป + จับคู่คำทำนาย */
export function findRepeatedGroups(natal: HouseReading[]): RepeatedGroup[] {
  const byValue = new Map<number, string[]>();
  for (const h of natal) {
    const arr = byValue.get(h.value) ?? [];
    arr.push(h.name);
    byValue.set(h.value, arr);
  }
  const groups: RepeatedGroup[] = [];
  for (const [value, houses] of byValue) {
    if (houses.length < 2) continue;
    const pairs: RepeatedPair[] = [];
    for (let i = 0; i < houses.length; i++)
      for (let j = i + 1; j < houses.length; j++) {
        pairs.push({ a: houses[i]!, b: houses[j]!, text: relationFallback(value) });
      }
    groups.push({ value, houses, pairs });
  }
  return groups.sort((x, y) => y.value - x.value);
}

const DOW_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export interface WeekdayReading {
  weekday: number;
  name: string;
  text: string;
}
/** คำทำนายตามวันเกิด (weekday 0=อาทิตย์..6=เสาร์) */
export function interpretWeekday(weekday: number): WeekdayReading {
  return { weekday, name: DOW_NAMES[weekday] ?? "", text: WEEKDAY_TEXT[weekday] ?? "" };
}

export interface LunarMonthReading {
  month: number; // 1..12 (เดือนอ้าย..เดือนสิบสอง)
  name: string;
  text: string;
}
/** คำทำนายตามเดือนเกิด (เดือนจันทรคติ 1..12 ; 88 = เดือน 8 หลัง/อธิกมาส) */
export function interpretBirthMonth(lunarMonth: number): LunarMonthReading {
  const isLeap8 = lunarMonth === 88;
  const m = isLeap8 ? 8 : lunarMonth;
  return {
    month: lunarMonth,
    name: (LUNAR_MONTH_NAMES[m] ?? "") + (isLeap8 ? " (หลัง/อธิกมาส)" : ""),
    text: LUNAR_MONTH_TEXT[m] ?? "",
  };
}

/** ข้อความ disclaimer มาตรฐาน — ใช้แสดงทุกผลลัพธ์ */
export const DISCLAIMER =
  "ผลทำนายนี้เป็นความเชื่อส่วนบุคคลเพื่อความบันเทิง " +
  "ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย โปรดใช้วิจารณญาณ";

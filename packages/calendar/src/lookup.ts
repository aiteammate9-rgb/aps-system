import { readFileSync } from "node:fs";

/**
 * ตารางอ้างอิงปฏิทินจันทรคติไทย — ดึงจาก myhora.com/calendar (พ.ศ. 2451–2570)
 * ใช้แทนการคำนวณสุริยยาตร์ในช่วงที่มีข้อมูล (engine สุริยยาตร์เป็น fallback นอกช่วง)
 *
 * cal-days:  { be: [[gm, d, ld, lm, nakIdx], ...] }
 *   gm = เดือนสุริยคติ 1..12 ; d = วันที่ ; ld = วันจันทรคติ 1..30 (1–15 ขึ้น, 16–30 แรม)
 *   lm = เดือนจันทรคติ 1..12 ; nakIdx = ปีนักษัตร 0..11 (ชวด=0..กุน=11)
 * cal-years: { be: { cs1, cs2, suratin, mas, wan } }  (สุรทิน/มาส/วาร ค่าเดียวต่อปี)
 */

interface YearMeta {
  cs1: number; cs2: number;
  suratin: "ปกติ" | "อธิก"; mas: "ปกติ" | "อธิก"; wan: "ปกติ" | "อธิก";
}

const days: Record<string, [number, number, number, number, number][]> = JSON.parse(
  readFileSync(new URL("./data/cal-days.json", import.meta.url), "utf8")
);
const years: Record<string, YearMeta> = JSON.parse(
  readFileSync(new URL("./data/cal-years.json", import.meta.url), "utf8")
);

// index รายวัน: key = ce*10000 + month*100 + day → [ld, lm, nakIdx]
const dayIndex = new Map<number, [number, number, number]>();
for (const be of Object.keys(days)) {
  const ce = Number(be) - 543;
  for (const [gm, d, ld, lm, nakIdx] of days[be]!) {
    dayIndex.set(ce * 10000 + gm * 100 + d, [ld, lm, nakIdx]);
  }
}

export interface LunarLookup {
  phase: "ขึ้น" | "แรม";
  phaseDay: number; // 1..15
  lunarDay: number; // 1..30
  lunarMonth: number; // 1..12
  naksatr: number; // 1..12 (ชวด=1..กุน=12)
}

/** ข้อมูลจันทรคติของวันที่ (ค.ศ.) จากตาราง myhora — null ถ้านอกช่วงข้อมูล */
export function lunarLookup(ceYear: number, month: number, day: number): LunarLookup | null {
  const hit = dayIndex.get(ceYear * 10000 + month * 100 + day);
  if (!hit) return null;
  const [ld, lm, nakIdx] = hit;
  return {
    phase: ld <= 15 ? "ขึ้น" : "แรม",
    phaseDay: ld <= 15 ? ld : ld - 15,
    lunarDay: ld,
    lunarMonth: lm,
    naksatr: nakIdx + 1,
  };
}

/** ข้อมูลรายปี (สุรทิน/มาส/วาร + ช่วง จ.ศ.) จากตาราง myhora — null ถ้านอกช่วง */
export function yearMetaLookup(ceYear: number): YearMeta | null {
  return years[String(ceYear + 543)] ?? null;
}

import type { ThaiLunarDate } from "@life-graph/types";
import { csLunarMonthFromJDN, csLunarFromJDN } from "./thai-lunar.js";
import { lunarLookup, yearMetaLookup } from "./lookup.js";

export { csLunarMonthFromJDN, csLunarFromJDN };
export { lunarLookup, yearMetaLookup };

const WEEKDAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const LUNAR_MONTH_NAMES_TH = ["", "อ้าย", "ยี่", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ", "สิบเอ็ด", "สิบสอง"];
const NAKSATR_NAMES = ["", "ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง", "มะเมีย", "มะแม", "วอก", "ระกา", "จอ", "กุน"];

export interface ThaiCalInfo {
  weekday: number; weekdayName: string;
  phase: "ขึ้น" | "แรม"; phaseDay: number; // ค่ำ (อาจ ±1 ที่วันคาบเส้น)
  lunarMonth: number; lunarMonthName: string;
  naksatr: number; naksatrName: string;
  be: number; cs: number; ms: number; rs: number;
  suratin: "ปกติ" | "อธิก"; // สุรทิน (ปีสุริยคติ 366 วัน)
  mas: "ปกติ" | "อธิก"; // มาส (อธิกมาส = เดือน 8 สองหน)
  wan: "ปกติ" | "อธิก"; // วาร (อธิกวาร = เพิ่มวันแรม 15 ค่ำเดือน 7)
}

/** ข้อมูลปฏิทินไทยครบของวันที่ (สำหรับแถบข้อมูลวันเกิด/วันจร) */
export function thaiCalendarInfo(year: number, month: number, day: number): ThaiCalInfo {
  const lk = lunarLookup(year, month, day); // ตาราง myhora (แม่น) — null ถ้านอกช่วง
  const meta = yearMetaLookup(year);
  const isGregLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  // จันทรคติ: ใช้ตาราง myhora ก่อน, ไม่มีค่อย fallback สุริยยาตร์
  let phase: "ขึ้น" | "แรม", phaseDay: number, lunarMonth: number, naksatr: number;
  let isLeap8 = false;
  if (lk) {
    phase = lk.phase; phaseDay = lk.phaseDay; lunarMonth = lk.lunarMonth; naksatr = lk.naksatr;
  } else {
    const lunar = csLunarFromJDN(julianDayNumber(year, month, day));
    isLeap8 = lunar.month === 88;
    lunarMonth = isLeap8 ? 8 : lunar.month;
    phase = lunar.day <= 15 ? "ขึ้น" : "แรม";
    phaseDay = lunar.day <= 15 ? lunar.day : lunar.day - 15;
    naksatr = ((zodiacYear(year, month) + 8) % 12) + 1;
  }

  // จ.ศ.: เลือก cs1/cs2 ตามก่อน/หลังเถลิงศก (~16 เม.ย.) ; มาส/วาร/สุรทิน: ค่ารายปีจาก myhora
  const beforeThoengsok = month < 4 || (month === 4 && day < 16);
  const cs = meta ? (beforeThoengsok ? meta.cs1 : meta.cs2) : year - 638;

  return {
    weekday: weekdayOf(year, month, day),
    weekdayName: WEEKDAY_NAMES[weekdayOf(year, month, day)]!,
    phase, phaseDay,
    lunarMonth,
    lunarMonthName: (LUNAR_MONTH_NAMES_TH[lunarMonth] ?? "") + (isLeap8 ? " (หลัง)" : ""),
    naksatr, naksatrName: NAKSATR_NAMES[naksatr]!,
    be: year + 543, cs, ms: year - 78, rs: year - 1781,
    suratin: meta ? meta.suratin : (isGregLeap ? "อธิก" : "ปกติ"),
    mas: meta ? meta.mas : "ปกติ",
    wan: meta ? meta.wan : "ปกติ",
  };
}

/**
 * Thai lunar ⇄ solar calendar conversion.
 *
 * ⚠️  PLACEHOLDER — NOT astronomically correct yet.
 * --------------------------------------------------
 * P1 จะแทนที่ด้วยอัลกอริทึมจริง (ปักขคณนา / สุริยยาตร์) ที่จัดการ:
 *   - เดือน 8 สองหน (อธิกมาส)
 *   - วันขึ้น/แรม 14–15 ค่ำ (อธิกวาร)
 * และต้องมีชุดทดสอบเทียบกับปฏิทินหลวงจริง
 *
 * ตอนนี้ให้ interface คงที่ไว้ก่อน เพื่อให้ส่วนอื่นเรียกใช้ได้
 */

const BE_OFFSET = 543; // พ.ศ. = ค.ศ. + 543

/** แปลง ค.ศ. → พ.ศ. */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + BE_OFFSET;
}

/** แปลง พ.ศ. → ค.ศ. */
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - BE_OFFSET;
}

/** parse "YYYY-MM-DD" เป็น UTC Date (timezone-safe) */
export function parseISODate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: "${iso}"`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** format Date (UTC) เป็น "YYYY-MM-DD" */
export function formatISODate(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

// ---------------------------------------------------------------------------
// Julian Day Number + Thai lunar month index (สุริยยาตร์)
// ใช้คำนวณ "ตัวเลื่อน S" ของกราฟชีวิต (= ดัชนีเดือนจันทรคติสะสม mod 12)
// ค่าคงที่อ้างอิงจากระบบจุลศักราช/สุริยยาตร์ (เทียบ pythaidate)
// ---------------------------------------------------------------------------

/** Chula Sakarat epoch ใน Julian Day Number */
export const CS_JULIAN_DAY_OFFSET = 1954167;

/** Julian Day Number ของวันที่สุริยคติ (เที่ยงคืน UTC) */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** วันในสัปดาห์ 0=อาทิตย์..6=เสาร์ */
export function weekdayOf(year: number, month: number, day: number): number {
  return ((julianDayNumber(year, month, day) + 1) % 7 + 7) % 7;
}

/**
 * masaken — จำนวนเดือนจันทรคติสะสมตั้งแต่ epoch จนถึงวันที่กำหนด
 * (Surya Siddhanta: นับ tithi แล้วหารด้วย 30)
 * boundary ที่ได้ตรงกับการเปลี่ยนเดือนของ myhora life-graph
 */
export function lunarMonthIndex(jdn: number): number {
  const horakhun = jdn - CS_JULIAN_DAY_OFFSET;
  const tithi = horakhun + Math.floor((horakhun * 11 + 650) / 692);
  return Math.floor(tithi / 30);
}

// สุริยยาตร์ constants สำหรับจำแนกปีอธิกมาส (port จาก pythaidate lsyear.py)
const DAYS_IN_800_YEARS = 292207;
const TIME_UNITS_IN_1_DAY = 800;
const EPOCH_OFFSET = 373;

/** ปีจุลศักราชนี้เป็น "ปีอธิกมาส" (มีเดือน 8 สองหน, 384 วัน) หรือไม่ */
export function isAdhikamasaYear(csYear: number): boolean {
  const horakhun =
    Math.floor((csYear * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS_IN_1_DAY) + 1;
  let avoman = (horakhun * 11 + 650) % 692;
  if (avoman === 0) avoman = 692;
  const avoQuot = Math.floor((horakhun * 11 + 650) / 692);
  let tithi = (avoQuot + horakhun) % 30;
  if (avoman === 692) tithi -= 1;
  const h1 =
    Math.floor(((csYear + 1) * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS_IN_1_DAY) + 1;
  const tithi1 = (Math.floor((h1 * 11 + 650) / 692) + h1) % 30;
  let leapMonth = tithi > 24 || tithi < 6;
  if (tithi === 25 && tithi1 === 5) leapMonth = false;
  return leapMonth;
}

/**
 * เดือนจันทรคติไทยของวันที่ (1=เดือนอ้าย .. 12=เดือนสิบสอง, 88=เดือน 8/8 อธิกมาส)
 *
 * ใช้ปฏิทินจันทรคติไทยเต็มรูป (สุริยยาตร์/จุลศักราช, port จาก pythaidate) ใน thai-lunar.ts
 * ตรงกับ myhora ~92% — คลาดได้เฉพาะ "วันคาบเส้นแบ่งเดือน" (±1 วัน) และบางปียุคเก่า (อธิกมาสวางต่างแหล่ง)
 * (ดู REVERSE-ENGINEERING.md)
 */
export function thaiLunarMonth(year: number, month: number, day: number): number {
  const lk = lunarLookup(year, month, day);
  if (lk) return lk.lunarMonth; // ตาราง myhora (แม่น)
  return csLunarMonthFromJDN(julianDayNumber(year, month, day));
}

/** ปีนักษัตร 1..12 (ชวด=1..กุน=12) — ใช้ตาราง myhora ก่อน, ไม่มีค่อยคำนวณ */
export function naksatrOf(year: number, month: number, day: number): number {
  const lk = lunarLookup(year, month, day);
  if (lk) return lk.naksatr;
  return ((zodiacYear(year, month) + 8) % 12) + 1;
}

/** ปีนักษัตร (เปลี่ยนช่วงสงกรานต์ ~เม.ย.): ม.ค.–มี.ค. นับเป็นปีก่อนหน้า */
export function zodiacYear(year: number, month: number): number {
  return year - (month < 4 ? 1 : 0);
}

const CS_LEAP_BASE = 1000; // ฐานนับอธิกมาสสะสม (ก่อนช่วงใช้งานจริง)

/** จำนวนปีอธิกมาสสะสมตั้งแต่ CS_LEAP_BASE ถึงก่อนปี csYear */
function cumulativeAdhikamasa(csYear: number): number {
  let n = 0;
  for (let y = CS_LEAP_BASE; y < csYear; y++) if (isAdhikamasaYear(y)) n++;
  return n;
}

/**
 * "ตัวเลื่อน S" ของกราฟชีวิต myhora (สเกลค่าสัมบูรณ์ ใช้หาผลต่างเท่านั้น):
 *   S = เดือนจันทรคติสะสม + ปีนักษัตร − อธิกมาสสะสม
 *
 * ⚠️ ความแม่น: ตรงกับ myhora ภายในปีเดียวกันเป๊ะ และข้ามทศวรรษส่วนใหญ่
 * แต่บางปีที่ใกล้เส้นอธิกมาส (พบที่ ~2015, 2020, 2025) อาจคลาด ±1
 * จะเป๊ะ 100% เมื่อ port การติดตามวันขึ้นปีจันทรคติ (nyd) เต็มรูปจาก pythaidate
 */
export function lifeGraphShift(year: number, month: number, day: number): number {
  const jdn = julianDayNumber(year, month, day);
  const cs = zodiacYear(year, month) - 638; // จุลศักราชของปีจันทรคติ
  return lunarMonthIndex(jdn) + zodiacYear(year, month) - cumulativeAdhikamasa(cs);
}

/**
 * แปลงสุริยคติ (ISO) → จันทรคติไทย
 * TODO(P1): แทนที่ด้วยอัลกอริทึมจริง — ตอนนี้คืนค่าโครงสร้างจำลอง
 */
export function solarToThaiLunar(iso: string): ThaiLunarDate {
  throw new NotImplementedError("solarToThaiLunar");
}

/**
 * แปลงจันทรคติไทย → สุริยคติ (ISO "YYYY-MM-DD")
 * TODO(P1): แทนที่ด้วยอัลกอริทึมจริง
 */
export function thaiLunarToSolar(_date: ThaiLunarDate): string {
  throw new NotImplementedError("thaiLunarToSolar");
}

export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn} is not implemented yet (planned for P1)`);
    this.name = "NotImplementedError";
  }
}

/**
 * Shared domain types for the Life Graph system.
 * Kept dependency-free so every package/app can import them.
 */

export type CalendarSystem = "solar" | "lunar";

/** ผลข้างขึ้น/ข้างแรม สำหรับปฏิทินจันทรคติไทย */
export type WaxWane = "wax" | "wane"; // ขึ้น | แรม

/** วันเกิดตามปฏิทินจันทรคติไทย */
export interface ThaiLunarDate {
  year: number; // พ.ศ.
  month: number; // เดือน 1..12 (เดือนอ้าย..เดือนสิบสอง)
  waxWane: WaxWane; // ขึ้น/แรม
  day: number; // ค่ำ 1..15
  isAthikamas?: boolean; // ปีที่มีเดือน 8 สองหน
}

/** Input ที่ผู้ใช้กรอก ก่อน normalize เข้า engine */
export interface BirthInput {
  /** ISO date "YYYY-MM-DD" (สุริยคติเสมอ — แปลงจากจันทรคติก่อนถ้าจำเป็น) */
  solarDate: string;
  /** "HH:mm" — ถ้าไม่ทราบใช้ "12:00" */
  birthTime?: string;
  /** IANA timezone เช่น "Asia/Bangkok" */
  timezone: string;
}

export interface DateRange {
  fromYear: number;
  toYear: number;
}

/** ค่าฐาน 12 ตัวที่แตกออกมา เพื่อความโปร่งใส/ดีบั๊ก */
export interface PillarBreakdown {
  /** ดัชนีฐาน 1..12 → ค่า */
  values: number[];
  /** label ของแต่ละฐาน (ภพ) เช่น "ตนุ", "กดุมภะ" ... */
  labels?: string[];
}

export interface YearPoint {
  year: number;
  age: number;
  score: number;
  pillars?: PillarBreakdown;
}

export interface LifeGraphResult {
  base12: number[];
  points: YearPoint[];
  peaks: number[];
  troughs: number[];
}

/** เมตาดาทาของผลที่บันทึก/แชร์ */
export interface SavedResult {
  shareId: string;
  name?: string;
  birth: BirthInput;
  range: DateRange;
  result: LifeGraphResult;
  createdAt: string;
  expiresAt?: string;
}

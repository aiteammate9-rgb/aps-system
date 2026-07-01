/**
 * ปฏิทินจันทรคติไทย (จุลศักราช/สุริยยาตร์) — port เต็มจาก pythaidate
 * (github hmmbug/pythaidate: lsyear.py + csdate.py)
 * ให้เดือนจันทรคติที่ตรงกับ myhora 100% (รวมอธิกมาส เดือน 8/8)
 */

const DAYS_IN_800_YEARS = 292207;
const TIME_UNITS = 800;
const EPOCH_OFFSET = 373;
const UCCAPON_CONSTANT = 2611;
const APOGEE_ROTATION_DAYS = 3232;
export const CS_JULIAN_DAY_OFFSET = 1954167;

const CAL_DAYS: Record<string, number> = { A: 354, B: 355, C: 384, c: 384 };

// LUNAR_MONTHS index → เลขเดือน (88 = เดือน 8 หลัง/อธิกมาส ; index 15,16 = เดือน 5,6 ของปีถัดไป)
const LUNAR_MONTHS = [0, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 8, 88, 5, 6];

// ตาราง find_date ต่อชนิดปี (A/B/C): [ขีดวัน, index เดือนใน LUNAR_MONTHS]
const FIND: Record<string, [number, number][]> = {
  A: [[383, 16], [354, 15], [324, 12], [295, 11], [265, 10], [236, 9], [206, 8], [177, 7], [147, 6], [118, 5], [88, 4], [59, 3], [29, 2]],
  B: [[384, 16], [355, 15], [325, 12], [296, 11], [266, 10], [237, 9], [207, 8], [178, 7], [148, 6], [119, 5], [89, 4], [59, 3], [29, 2]],
  C: [[384, 15], [354, 12], [325, 11], [295, 10], [266, 9], [236, 8], [207, 7], [177, 6], [148, 5], [118, 14], [88, 13], [59, 3], [29, 2]],
};

interface LSYear {
  horakhun: number; kammacapon: number; tithi: number; weekday: number;
  langsak: number; nyd: number; next_nyd: number; leapday: boolean;
  cal_type: string; offset: boolean;
}

function lsYear(year: number): LSYear {
  const base = year * DAYS_IN_800_YEARS + EPOCH_OFFSET;
  const horakhun = Math.floor(base / TIME_UNITS) + 1;
  const kammacapon = TIME_UNITS - (base % TIME_UNITS);
  const avoQuot = Math.floor((horakhun * 11 + 650) / 692);
  let avoman = (horakhun * 11 + 650) % 692;
  if (avoman === 0) avoman = 692;
  let tithi = (avoQuot + horakhun) % 30;
  if (avoman === 692) tithi -= 1;
  const weekday = horakhun % 7;

  const h1 = Math.floor(((year + 1) * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS) + 1;
  const tithi1 = (Math.floor((h1 * 11 + 650) / 692) + h1) % 30;

  let langsak = Math.max(1, tithi);
  let nyd = langsak;
  if (nyd < 6) nyd += 29;
  nyd = (weekday - nyd + 1 + 35) % 7;
  const leapday = kammacapon <= 207;

  let cal_type = "A";
  if (tithi > 24 || tithi < 6) cal_type = "C";
  if (tithi === 25 && tithi1 === 5) cal_type = "A";
  if ((leapday && avoman <= 126) || (!leapday && avoman <= 137))
    cal_type = cal_type !== "C" ? "B" : "c";

  let next_nyd: number;
  if (cal_type === "A") next_nyd = (nyd + 4) % 7;
  else if (cal_type === "B") next_nyd = (nyd + 5) % 7;
  else next_nyd = (nyd + 6) % 7; // C / c

  return { horakhun, kammacapon, tithi, weekday, langsak, nyd, next_nyd, leapday, cal_type, offset: false };
}

interface Year0 extends LSYear { offset_days: number; }

function calculateYear0(year: number): Year0 {
  const y = [year - 2, year - 1, year, year + 1, year + 2].map(lsYear);

  if (y[2]!.tithi === 24 && y[3]!.tithi === 6) {
    for (let i = 0; i < 5; i++) {
      y[i]!.cal_type = "C";
      y[i]!.next_nyd = (y[i]!.next_nyd + 2) % 7;
    }
  }
  for (const i of [1, 2, 3]) {
    if (y[i]!.cal_type === "c") {
      const j = y[i]!.nyd === y[i - 1]!.next_nyd ? 1 : -1;
      y[i + j]!.cal_type = "B";
      y[i + j]!.next_nyd = (y[i + j]!.next_nyd + 1) % 7;
    }
  }
  for (const i of [1, 2, 3]) {
    if (y[i - 1]!.next_nyd !== y[i]!.nyd && y[i]!.next_nyd !== y[i + 1]!.nyd) {
      y[i]!.offset = true;
      y[i]!.langsak += 1;
      y[i]!.nyd = (y[i]!.nyd + 6) % 7;
      y[i]!.next_nyd = (y[i]!.next_nyd + 6) % 7;
    }
  }
  for (let i = 0; i < 5; i++) if (y[i]!.cal_type === "c") y[i]!.cal_type = "C";

  const c = y[2]!;
  let offset_days = c.langsak;
  if (offset_days < 6 + (c.offset ? 1 : 0)) offset_days += 29;
  return { ...c, offset_days };
}

/** หา (เลขเดือน, วันในเดือน) จากชนิดปี + จำนวนวันนับจากวันขึ้นปี */
function findMonthDay(cal: string, days: number): { month: number; day: number } {
  for (const [a, b] of FIND[cal]!) {
    if (days > a) return { month: LUNAR_MONTHS[b]!, day: days - a };
  }
  return { month: LUNAR_MONTHS[1]!, day: days }; // เดือน 5
}

export interface CsLunar {
  month: number; // 5,6,..,12,1,..,4 ; 88 = เดือน 8/8
  day: number; // วันในเดือนจันทรคติ (1..30)
  calType: string; // A=ปกติ, B=อธิกวาร, C=อธิกมาส (ผ่าน calculateYear0 — ใช้คำนวณเดือน/วัน)
  rawCalType: string; // cal_type ดิบจาก lsYear (ไม่โยน c→B ข้ามปี) — myhora ใช้ตัวนี้โชว์ มาส/วาร
}

/** ข้อมูลจันทรคติไทยจาก Julian Day Number */
export function csLunarFromJDN(jd: number): CsLunar {
  const hk = jd - CS_JULIAN_DAY_OFFSET;
  let year = Math.floor((hk * 800 - 373) / 292207);
  let days: number;
  if (((hk % 292207) + 292207) % 292207 === 95333) {
    year -= 1;
    days = 365;
  } else {
    days = hk - calculateYear0(year).horakhun;
  }
  let year0 = calculateYear0(year);
  let daysInYear = 365 + (year0.leapday ? 1 : 0);
  while (days > daysInYear) {
    year += 1;
    days -= daysInYear;
    year0 = calculateYear0(year);
    daysInYear = 365 + (year0.leapday ? 1 : 0);
  }
  const md = findMonthDay(year0.cal_type, year0.offset_days + days);
  return { month: md.month, day: md.day, calType: year0.cal_type, rawCalType: lsYear(year).cal_type };
}

/** เลขเดือนจันทรคติไทยจาก JDN (backward-compat) */
export function csLunarMonthFromJDN(jd: number): number {
  return csLunarFromJDN(jd).month;
}

import type {
  BirthInput,
  DateRange,
  LifeGraphResult,
  YearPoint,
} from "@life-graph/types";
import { weekdayOf, thaiLunarMonth, naksatrOf } from "@life-graph/calendar";

/**
 * Life Graph engine — "พยากรณ์ศาสตร์เลข 12 ตัว / กราฟชีวิต".
 *
 * สูตรตามตำราฐานเลข 12 ตัว (ดัดแปลงจากเลข 7 ตัว):
 *   เลขดวง[ภพ h] = ((ฐานวัน[h] + ฐานเดือน[h] + ฐานปี[h] − 1) mod 12) + 1
 *     - ฐานวัน  = วันในสัปดาห์ (อา=1..เสาร์=7), 7 ช่องแรก
 *     - ฐานเดือน = เดือน "จันทรคติ" เกิด (เดือนอ้าย=1..สิบสอง=12) — ตามปฏิทินจันทรคติไทย
 *     - ฐานปี   = ปีนักษัตร (ชวด=1..กุน=12)
 *   value(age) = base[age mod 12]  (จำนวนเต็ม 1..12, คาบ 12 ปี)
 */

/** ป้ายกำกับ 12 ภพ ตามหลักโหราศาสตร์ไทย (ใช้แสดงผล/ดีบั๊ก) */
export const PILLAR_LABELS = [
  "ตนุ", // 1 ตัวเรา
  "กดุมภะ", // 2 ทรัพย์
  "สหัชชะ", // 3 พี่น้อง
  "พันธุ", // 4 ที่อยู่/ญาติ
  "ปุตตะ", // 5 บุตร/บริวาร
  "อริ", // 6 ศัตรู/โรค
  "ปัตนิ", // 7 คู่ครอง
  "มรณะ", // 8 ความตาย/เปลี่ยนแปลง
  "ศุภะ", // 9 ความสำเร็จ/บุญ
  "กัมมะ", // 10 การงาน
  "ลาภะ", // 11 ลาภผล
  "พยายะ", // 12 รายจ่าย/ทุกข์
] as const;

/** parse "YYYY-MM-DD" แบบ timezone-safe (ไม่พึ่ง Date.parse ที่แปลง local) */
function parseSolarDate(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error(`Invalid solarDate, expected YYYY-MM-DD: "${iso}"`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error(`Invalid solarDate value: "${iso}"`);
  }
  return { y, m, d };
}

/**
 * แปลงวันเกิด → เลขฐาน 12 ตัว (index = age mod 12, ค่า 1..12)
 */
export function deriveBase12(input: BirthInput): number[] {
  const { y, m, d } = parseSolarDate(input.solarDate);
  const wNum = weekdayOf(y, m, d) + 1; // 1=อาทิตย์..7=เสาร์
  const lm = thaiLunarMonth(y, m, d);
  const monthNum = lm === 88 ? 8 : lm; // เดือนจันทรคติเกิด (อ้าย=1..สิบสอง=12)
  const naksatr = naksatrOf(y, m, d); // ชวด=1..กุน=12 (ตาราง myhora ก่อน)
  // เลขดวงราย "ภพ" (ตำแหน่ง 1..12) ตามตำรา
  const posVal = Array.from({ length: 12 }, (_, j) => {
    const dayB = j < 7 ? ((wNum - 1 + j) % 7) + 1 : 0; // ฐานวัน 7 ช่อง
    const monthB = ((monthNum - 1 + j) % 12) + 1; // ฐานเดือน
    const yearB = ((naksatr - 1 + j) % 12) + 1; // ฐานปี
    return (((dayB + monthB + yearB - 1) % 12) + 12) % 12 + 1;
  });
  // base index = age mod 12 (อายุ=ภพ ; ภพ12 ↔ residue 0)
  return Array.from({ length: 12 }, (_, r) => posVal[(r + 11) % 12]!);
}

/**
 * ค่าระดับชีวิตของปีหนึ่ง ๆ = base[age mod 12] (จำนวนเต็ม 1..12, 12=ดีสุด)
 */
export function scoreYear(base12: number[], age: number): number {
  const idx = ((age % 12) + 12) % 12;
  return base12[idx]!;
}

/** หาปีที่เป็นจุดสูงสุด/ต่ำสุดเฉพาะที่ (local extrema) */
function findExtrema(points: YearPoint[]): { peaks: number[]; troughs: number[] } {
  const peaks: number[] = [];
  const troughs: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!.score;
    const cur = points[i]!.score;
    const next = points[i + 1]!.score;
    if (cur > prev && cur >= next) peaks.push(points[i]!.year);
    if (cur < prev && cur <= next) troughs.push(points[i]!.year);
  }
  return { peaks, troughs };
}

/**
 * คำนวณกราฟชีวิตรายปีในช่วงที่กำหนด
 * @param input วันเกิด (สุริยคติ normalize แล้ว)
 * @param range ช่วงปี (ค.ศ.) ที่ต้องการ
 */
export function computeLifeGraph(
  input: BirthInput,
  range: DateRange
): LifeGraphResult {
  if (range.toYear < range.fromYear) {
    throw new Error("range.toYear must be >= range.fromYear");
  }
  const { y: birthYear } = parseSolarDate(input.solarDate);
  const base12 = deriveBase12(input);

  const points: YearPoint[] = [];
  for (let year = range.fromYear; year <= range.toYear; year++) {
    const age = year - birthYear;
    points.push({
      year,
      age,
      score: scoreYear(base12, age),
      pillars: { values: base12, labels: [...PILLAR_LABELS] },
    });
  }

  const { peaks, troughs } = findExtrema(points);
  return { base12, points, peaks, troughs };
}

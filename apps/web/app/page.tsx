"use client";

import { useState, useEffect, useRef } from "react";
import { CELEBS, type Celeb } from "./celebs";
import { text } from "stream/consumers";

interface Natal {
  no: number;
  name: string;
  meaning: string;
  value: number;
  realm: string;
  text: string;
}
interface ApiResponse {
  name?: string;
  birth: { solarDate: string };
  result: {
    base12: number[];
    points: { year: number; age: number; score: number }[];
    peaks: number[];
    troughs: number[];
  };
  natal: Natal[];
  repeatedGroups: RepeatedGroup[];
  weekday: { weekday: number; name: string; text: string };
  birthMonth: { month: number; name: string; text: string };
  birthInfo: ThaiCalInfo;
  viewDate: string;
  transitInfo: ThaiCalInfo;
  yearlyTransits: { age: number; value: number; house: string; poem: string }[];
  divination: Divination;
  disclaimer: string;
}
interface Divination {
  taksa: {
    birthPlanet: string;
    houses: { house: string; planet: string; color: string; meaning: string }[];
    kalakiniPlanet: string; avoidColor: string;
    sriPlanet: string; luckColor: string;
    dechPlanet: string; powerColor: string;
  };
  rasi: { name: string; element: string; ruler: string; text: string };
  numerology: { sum: number; root: number; text: string };
  chong: { status: string; birthNak: string; yearNak: string; text: string };
  elementProfile: { rasiElement: string; yearElement: string; dayPlanet: string; text: string };
}
interface CompatResult {
  a: { naksatrName: string; rasiElement: string };
  b: { naksatrName: string; rasiElement: string };
  compatibility: { level: string; score: number; percent: number; emoji: string; naksatrRel: string; elementRel: string; weekdayRel: string; text: string };
}
interface ThaiCalInfo {
  weekday: number; weekdayName: string;
  phase: string; phaseDay: number;
  lunarMonth: number; lunarMonthName: string;
  naksatr: number; naksatrName: string;
  be: number; cs: number; ms: number; rs: number;
  suratin: string; mas: string; wan: string;
}
interface RepeatedGroup { value: number; houses: string[]; pairs: { a: string; b: string; text: string | null }[]; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const YEARS = Array.from({ length: 2026 - 1920 + 1 }, (_, i) => 1920 + i); // ค.ศ. 1920..2026 (วันเกิด)
const ZODIAC = ["วอก", "ระกา", "จอ", "กุน", "ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง", "มะเมีย", "มะแม"];
const wrap12 = (n: number) => (((n - 1) % 12) + 12) % 12 + 1;
const toThaiNum = (n: number) => String(n).replace(/\d/g, (d) => "๐๑๒๓๔๕๖๗๘๙"[+d]!);

/** วันที่วันนี้เป็น ISO "YYYY-MM-DD" (ฝั่ง client) */
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** เส้นโค้งนุ่มผ่านจุด (Catmull-Rom → cubic bezier) */
function smoothPath(P: [number, number][]): string {
  if (P.length < 2) return P.length ? `M${P[0]![0]},${P[0]![1]}` : "";
  let d = `M${P[0]![0]},${P[0]![1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2] ?? P[i + 1]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// ---- เรขาคณิตร่วม: ทุกส่วนใช้ 12 คอลัมน์ตรงกัน ----
const LBL = 96;
const COL = 58;
const RGT = 78;
const GRID_W = LBL + 12 * COL;

// ตาราง: ใช้ border-collapse:separate + box-sizing:border-box เพื่อให้คอลัมน์กว้างเป๊ะ (ตรงกับ SVG)
const tableStyle = (w: number): React.CSSProperties => ({
  boxSizing: "content-box", // ให้ borderRight/Bottom ของ table อยู่นอกความกว้าง cells (ขอบไม่หาย)
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  width: w,
  borderRight: "1px solid #2c3658",
  borderBottom: "1px solid #2c3658",
});
const baseCell: React.CSSProperties = {
  boxSizing: "border-box",
  borderLeft: "1px solid #2c3658",
  borderTop: "1px solid #2c3658",
  textAlign: "center",
  padding: 0,
};

export default function Home() {
  const [bDay, setBDay] = useState(15);
  const [bMonth, setBMonth] = useState(8); // 1..12
  const [bYear, setBYear] = useState(1995); // ค.ศ.
  const [name, setName] = useState("");
  const [viewDate, setViewDate] = useState(""); // วันจร (ดีฟอลต์ = วันนี้)
  const date = `${bYear}-${String(bMonth).padStart(2, "0")}-${String(bDay).padStart(2, "0")}`;
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ตั้งวันจรเป็นวันที่ปัจจุบันอัตโนมัติ (client-side, กัน hydration mismatch)
  useEffect(() => setViewDate(isoToday()), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const birthYear = Number(date.slice(0, 4));
      const res = await fetch(`${API_BASE}/v1/life-graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birth: { date }, viewDate, range: { fromYear: birthYear, toYear: birthYear + 95 } }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 4 }}>🔮 ดูดวง กราฟชีวิต Sheowa.com</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>พยากรณ์ศาสตร์เลข 12 ตัว</p>

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 24 }}>
        <label style={fieldStyle}><span style={capStyle}>ชื่อ-สกุล</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ไม่บังคับ" style={inputStyle} /></label>
        <label style={fieldStyle}><span style={capStyle}>วันเดือนปีเกิด</span>
          <span style={{ display: "flex", gap: 6 }}>
            <select value={bDay} onChange={(e) => setBDay(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={bMonth} onChange={(e) => setBMonth(Number(e.target.value))} style={selectStyle}>
              {THAI_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m} ({String(i + 1).padStart(2, "0")})</option>)}
            </select>
            <select value={bYear} onChange={(e) => setBYear(Number(e.target.value))} style={selectStyle}>
              {YEARS.map((y) => <option key={y} value={y}>{y + 543} / {y}</option>)}
            </select>
          </span></label>
        <label style={fieldStyle}><span style={capStyle}>วันจร (วันที่ดู)</span>
          <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} style={inputStyle} /></label>
        <button type="submit" disabled={loading} style={btnStyle}>{loading ? "กำลังคำนวณ..." : "ทำนาย"}</button>
      </form>

      {error && <p style={{ color: "#ff8a8a" }}>{error}</p>}
      {data && viewDate && <Result data={data} viewDate={viewDate} />}
    </main>
  );
}

/**
 * แยกฐานตามตำราจริง:
 *  ฐานเดือน = เริ่มที่เดือนจันทรคติเกิด, ฐานปี = เริ่มที่นักษัตรปีเกิด (วิ่ง +1/ภพ)
 *  ฐานวัน (ฐานวาร 7 ช่อง) = เลขดวง − ฐานเดือน − ฐานปี
 */
function decompose(natal: Natal[], lunarMonth: number, naksatr: number) {
  return natal.map((n, h) => {
    const monthB = wrap12(lunarMonth + h);
    const yearB = wrap12(naksatr + h);
    const dayB = h <= 6 ? wrap12(n.value - monthB - yearB) : null;
    const sum = (dayB ?? 0) + monthB + yearB;
    return { dayB, monthB, yearB, sum, total: n.value };
  });
}

function Result({ data, viewDate }: { data: ApiResponse; viewDate: string }) {
  const birthYear = Number(data.birth.solarDate.slice(0, 4));
  const birthMon = Number(data.birth.solarDate.slice(5, 7));
  const lunarMonth = data.birthMonth.month === 88 ? 8 : data.birthMonth.month;
  const zYear = birthYear - (birthMon < 4 ? 1 : 0); // ปีนักษัตรเปลี่ยนช่วงสงกรานต์
  const naksatr = ((zYear + 8) % 12) + 1; // 1=ชวด..12=กุน
  const rows = decompose(data.natal, lunarMonth, naksatr);
  const viewYear = Number(viewDate.slice(0, 4));
  const viewMonth = Number(viewDate.slice(5, 7));
  const curAge = Math.max(0, viewYear - birthYear);
  // ดีฟอลต์โฟกัส = "ปีที่ทำนาย" (อายุ+1 = ปีปักธง) เช่น วันจร 2569 → โฟกัส 2570
  const [centerAge, setCenterAge] = useState(curAge + 1);
  const [view, setView] = useState<"v" | "h" | "line" | "full">("full");
  // เปลี่ยนวันจร → รีเซ็ตโฟกัสไปปีที่ทำนายใหม่
  useEffect(() => setCenterAge(curAge + 1), [curAge]);
  return (
    <div style={{ overflowX: "auto" }}>
      <InfoBanner data={data} curAge={curAge} />
      <div style={{ width: GRID_W + RGT }}>
        <BaseTable rows={rows} natal={data.natal} light />
        <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
          {([["full", "📊 แบบเต็ม"], ["v", "📜 แนวตั้ง"], ["h", "🗺️ งูเลื้อย"], ["line", "📈 กราฟเส้น"]] as const).map(([k, lbl]) => {
            const on = k === view;
            return (
              <button key={k} onClick={() => setView(k)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: on ? "1px solid #2f6fe0" : "1px solid #d5dcea",
                background: on ? "#e7efff" : "#ffffff", color: on ? "#2f6fe0" : "#6b7794",
              }}>{lbl}</button>
            );
          })}
        </div>
        {view !== "line" && (
          <div style={{ fontWeight: 700, color: "#2f6fb0", fontSize: 14, fontFamily: TF, padding: "8px 6px", background: "#eef2f9", borderRadius: "10px 10px 0 0", border: "1px solid #e2e7f0", borderBottom: "none" }}>
            {view === "full" ? "📊 กราฟพยากรณ์ชีวิต ๑๒ ตัว" : view === "v" ? "📜 ไทม์ไลน์ชีวิต — เลขดวงรายปี" : "🗺️ ไทม์ไลน์ชีวิต — เลขดวงรายปี (สูง=ดี · ต่ำ=ระวัง)"}
          </div>
        )}
        <div style={{ height: view === "line" ? 410 : 600, overflowY: "auto", overflowX: "hidden", borderRadius: view === "line" ? 10 : "0 0 10px 10px", border: "1px solid #e2e7f0", background: "#ffffff", ...(view === "h" ? { display: "flex", alignItems: "center", justifyContent: "center" } : {}) }}>
          {view === "full"
            ? <LifeChartFull natal={data.natal} base12={data.result.base12} centerAge={centerAge} curAge={curAge} birthYear={birthYear} birthLunarMonth={lunarMonth} />
            : view === "v"
              ? <LifeTimelineV natal={data.natal} base12={data.result.base12} centerAge={centerAge} curAge={curAge} birthYear={birthYear} />
              : view === "h"
                ? <LifeTimeline natal={data.natal} base12={data.result.base12} centerAge={centerAge} curAge={curAge} birthYear={birthYear} />
                : <LifeGraph natal={data.natal} base12={data.result.base12} centerAge={centerAge} curAge={curAge} birthYear={birthYear} birthLunarMonth={lunarMonth} />}
        </div>
        <YearTable data={data} centerAge={centerAge} setCenterAge={setCenterAge} curAge={curAge} light />
        <p style={{ fontSize: 11, color: "#7b88ad", marginTop: 8, lineHeight: 1.5 }}>
          🔴 จุดสีแดง = ปีกราฟลงต่ำ (ควรระวัง), 🟡 = ปีกราฟขึ้นสูง (ดี) — เปอร์เซ็นต์มาก/กราฟสูงจะดีกว่าปีที่กราฟต่ำ
        </p>
      </div>
      <Predictions data={data} centerAge={centerAge} />
      <p style={{ fontSize: 12, opacity: 0.5, marginTop: 16 }}>{data.disclaimer}</p>
    </div>
  );
}

/* ---------- แถบข้อมูลวันเกิด (บนสุด) ---------- */
function InfoBanner({ data, curAge }: { data: ApiResponse; curAge: number }) {
  const [y, m, d] = data.birth.solarDate.split("-").map(Number);
  const b = data.birthInfo;
  return (
    <div style={{
      background: "linear-gradient(135deg, #eef4ff 0%, #dce9ff 60%, #eef4ff 100%)",
      border: "1px solid #cbd5e8", borderRadius: 10, padding: "12px 18px", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{ fontSize: 38, lineHeight: 1 }}>🌙</div>
      <div style={{ lineHeight: 1.7, fontSize: 14 }}>
        <div style={{ color: "#26324d" }}>เกิดวันที่ {d} {THAI_MONTHS_FULL[(m! - 1)]} พ.ศ.{b.be} / ค.ศ.{y} เวลา 12:00น.</div>
        <div style={{ color: "#b07d12" }}>วัน{b.weekdayName} {b.phase} {toThaiNum(b.phaseDay)} ค่ำ เดือน{b.lunarMonthName} ({toThaiNum(b.lunarMonth)}) ปี{b.naksatrName}</div>
        <div style={{ color: "#5a6b8a", fontSize: 12.5 }}>จ.ศ. {b.cs} · ม.ศ. {b.ms} · ร.ศ. {b.rs} · {b.suratin}สุรทิน {b.mas}มาส {b.wan}วาร</div>
        <div style={{ color: "#2f6fb0", fontSize: 13 }}>อายุ {curAge} ปี · อายุเต็ม/ราชการ {curAge} ปี · อายุย่าง/โหร {curAge + 1} ปี ({curAge + Number(y) + 544})</div>
      </div>
    </div>
  );
}

/* ---------- แถบข้อมูลวันจร (ใต้หัวข้อ 2) ---------- */
function TransitBanner({ data }: { data: ApiResponse }) {
  const [y, m, d] = data.viewDate.split("-").map(Number);
  const t = data.transitInfo;
  return (
    <div style={{
      background: "linear-gradient(135deg, #eef4ff 0%, #dce9ff 60%, #eef4ff 100%)",
      border: "1px solid #cbd5e8", borderRadius: 10, padding: "12px 18px", margin: "10px 0 14px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{ fontSize: 38, lineHeight: 1 }}>🌙</div>
      <div style={{ lineHeight: 1.7, fontSize: 14 }}>
        <div style={{ color: "#26324d" }}>วันจร วันที่ {d} {THAI_MONTHS_FULL[(m! - 1)]} พ.ศ.{t.be} / ค.ศ.{y}</div>
        <div style={{ color: "#b07d12" }}>วัน{t.weekdayName} {t.phase} {toThaiNum(t.phaseDay)} ค่ำ เดือน{t.lunarMonthName} ({toThaiNum(t.lunarMonth)}) ปี{t.naksatrName}</div>
        <div style={{ color: "#5a6b8a", fontSize: 12.5 }}>จ.ศ. {t.cs} · ม.ศ. {t.ms} · ร.ศ. {t.rs} · {t.suratin}สุรทิน {t.mas}มาส {t.wan}วาร</div>
      </div>
    </div>
  );
}

/* ---------- คำทำนาย 3 หมวด ---------- */
function SectionHead({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, borderBottom: "2px solid #dbe2ee", paddingBottom: 6, marginTop: 28, color: "#26324d" }}>{children}</h2>;
}
function Predictions({ data, centerAge }: { data: ApiResponse; centerAge: number }) {
  const birthYear = Number(data.birth.solarDate.slice(0, 4));
  const win = Array.from({ length: 12 }, (_, i) => {
    const age = centerAge + 1 + i;
    return { age, year: birthYear + age + 543, v: data.result.base12[((age % 12) + 12) % 12]! };
  });
  const hi = win.reduce((a, b) => (b.v > a.v ? b : a));
  const lo = win.reduce((a, b) => (b.v < a.v ? b : a));
  return (
    <div>
      <SectionHead>1. ทำนายพื้นดวง</SectionHead>
      <h3 style={{ color: "#2f6fb0" }}>ทำนายตรง (ภพที่ตกเลขเดียวกัน ≥ 2)</h3>
      {data.repeatedGroups.length === 0 && <p style={{ opacity: 0.6 }}>ไม่มีภพที่ตกเลขซ้ำกัน</p>}
      {data.repeatedGroups.flatMap((g) =>
        g.pairs.map((p, i) => (
          <div key={g.value + "-" + i} style={cardStyle}>
            <div style={{ fontWeight: 700 }}>{p.a} สัมพันธ์กับ {p.b} <span style={{ color: "#ffd23f" }}>ตกเลข {g.value}</span></div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{p.text ?? "(ยังไม่มีคำทำนายคู่นี้ในคลัง)"}</div>
          </div>
        ))
      )}
      <h3 style={{ color: "#2f6fb0", marginTop: 18 }}>คำทำนายระดับเลข (12 ภพ)</h3>
      <NatalReadings natal={data.natal} />

      <SectionHead>2. ทำนายดวงชะตาจร</SectionHead>
      <TransitBanner data={data} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ ...cardStyle, flex: 1, minWidth: 240, border: "1px solid #2e6b3e" }}>
          <div style={{ fontWeight: 700, color: "#37d67a" }}>📈 ช่วงกราฟขึ้นสูง (ดี)</div>
          <div style={{ marginTop: 4 }}>พ.ศ. {hi.year} · อายุ {hi.age} ปี · เลข {hi.v} ({Math.floor((hi.v / 12) * 100)}%)</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>จังหวะชีวิตดี เหมาะริเริ่ม ลงทุน ตัดสินใจเรื่องสำคัญ</div>
        </div>
        <div style={{ ...cardStyle, flex: 1, minWidth: 240, border: "1px solid #6b2e2e" }}>
          <div style={{ fontWeight: 700, color: "#ff6b6b" }}>📉 ช่วงกราฟลงต่ำ (ระวัง)</div>
          <div style={{ marginTop: 4 }}>พ.ศ. {lo.year} · อายุ {lo.age} ปี · เลข {lo.v} ({Math.floor((lo.v / 12) * 100)}%)</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>ควรระมัดระวัง ตั้งรับ หลีกเลี่ยงความเสี่ยงใหญ่</div>
        </div>
      </div>
      {data.yearlyTransits.map((t) => (
        <div key={t.age}>
          <h3 style={{ color: "#2f6fb0", marginTop: 18 }}>
            คำทำนายประจำปี อายุ {t.age - 1}–{t.age} ปี (พ.ศ. {birthYear + t.age - 1 + 543}–{birthYear + t.age + 543})
            <span style={{ color: "#ffd23f", fontSize: 14 }}> (เลข {t.value})</span>
          </h3>
          <div style={{ ...cardStyle, whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 13 }}>{t.poem || "(ไม่มีกลอน)"}</div>
        </div>
      ))}

      <SectionHead>3. ทำนายตามวันเกิดและเดือนเกิด</SectionHead>
      <h3 style={{ color: "#2f6fb0" }}>คำทำนายตามวันเกิด (วัน{data.weekday.name})</h3>
      <div style={{ ...cardStyle, whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 13 }}>{data.weekday.text || "(ไม่มีข้อมูล)"}</div>
      <h3 style={{ color: "#2f6fb0", marginTop: 18 }}>คำทำนายตามเดือนเกิด (เดือน{data.birthMonth.name} — จันทรคติ)</h3>
      <div style={{ ...cardStyle, whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 13 }}>{data.birthMonth.text || "(ไม่มีข้อมูล)"}</div>

      <SectionHead>4. ศาสตร์เสริม (ทักษา · ราศี · เลขศาสตร์ · ปีชง · ธาตุ)</SectionHead>
      <Divination d={data.divination} />

      <SectionHead>5. คู่สมพงษ์ (เทียบ 2 ดวง)</SectionHead>
      <Compatibility personADate={data.birth.solarDate} />

      <SectionHead>6. จับคู่ดารา/ไอดอล 🌟</SectionHead>
      <CelebMatch personADate={data.birth.solarDate} />

      <SectionHead>7. การ์ดดวงแชร์ได้ 📤 (4 สไตล์ เลือกบันทึกได้)</SectionHead>
      <ShareCards data={data} />
    </div>
  );
}

/* ---------- 4 ศาสตร์เสริม ---------- */
function Divination({ d }: { d: Divination }) {
  const { taksa, rasi, numerology, chong } = d;
  const chongColor = chong.status === "ไม่ชง" ? "#37d67a" : chong.status === "ชงตรง" ? "#ff6b6b" : "#ffd23f";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {/* ทักษา */}
      <div style={{ ...cardStyle }}>
        <div style={{ fontWeight: 700, color: "#2f6fb0" }}>🪐 ทักษา (ดาวเจ้าเรือนวันเกิด: {taksa.birthPlanet})</div>
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11 }}>
          {taksa.houses.map((h) => (
            <span key={h.house} title={h.meaning} style={{ background: h.house === "กาลกิณี" ? "#fdeaea" : h.house === "ศรี" ? "#e7f6ec" : "#eef2f9", border: "1px solid #d5dcea", borderRadius: 4, padding: "2px 6px" }}>
              {h.house}:{h.planet}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
          <div>✅ <b style={{ color: "#37d67a" }}>สีเสริมโชค/เสน่ห์ (ศรี):</b> {taksa.luckColor}</div>
          <div>👑 <b style={{ color: "#ffd23f" }}>สีเสริมอำนาจ (เดช):</b> {taksa.powerColor}</div>
          <div>⛔ <b style={{ color: "#ff6b6b" }}>สีต้องห้าม (กาลกิณี={taksa.kalakiniPlanet}):</b> {taksa.avoidColor}</div>
        </div>
      </div>
      {/* ราศี */}
      <div style={{ ...cardStyle }}>
        <div style={{ fontWeight: 700, color: "#2f6fb0" }}>♈ ราศีเกิด (สุริยคติ): {rasi.name}</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>ธาตุ <b>{rasi.element}</b> · ดาวเจ้าเรือน <b>{rasi.ruler}</b></div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>{rasi.text}</div>
      </div>
      {/* เลขศาสตร์ */}
      <div style={{ ...cardStyle }}>
        <div style={{ fontWeight: 700, color: "#2f6fb0" }}>🔢 เลขศาสตร์ (ผลรวมวันเดือนปีเกิด)</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>ผลรวม <b style={{ color: "#ffd23f" }}>{numerology.sum}</b> → รากเลข <b style={{ color: "#ffd23f" }}>{numerology.root}</b></div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>{numerology.text}</div>
      </div>
      {/* ปีชง */}
      <div style={{ ...cardStyle, border: `1px solid ${chongColor}66` }}>
        <div style={{ fontWeight: 700, color: chongColor }}>🧧 ปีชง (ปีเกิด {chong.birthNak} · ปีที่ดู {chong.yearNak})</div>
        <div style={{ marginTop: 6, fontSize: 14 }}>สถานะ: <b style={{ color: chongColor }}>{chong.status}</b></div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>{chong.text}</div>
      </div>
      {/* ธาตุประจำตัว (วัน×ปี / เดือน×ปี) */}
      <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
        <div style={{ fontWeight: 700, color: "#2f6fb0" }}>🌿 ธาตุประจำตัว (ราศี × ปีนักษัตร × ดาวเจ้าวัน)</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>
          ธาตุราศี <b style={{ color: "#ffd23f" }}>{d.elementProfile.rasiElement}</b> ·
          ธาตุปีนักษัตร <b style={{ color: "#ffd23f" }}>{d.elementProfile.yearElement}</b> ·
          ดาวเจ้าวัน <b style={{ color: "#ffd23f" }}>{d.elementProfile.dayPlanet}</b>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>{d.elementProfile.text}</div>
      </div>
    </div>
  );
}

/* ---------- 5. คู่สมพงษ์ (เทียบ 2 คน) ---------- */
function Compatibility({ personADate }: { personADate: string }) {
  const [bDay, setBDay] = useState(15);
  const [bMonth, setBMonth] = useState(8);
  const [bYear, setBYear] = useState(1995);
  const [res, setRes] = useState<CompatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const check = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const bDate = `${bYear}-${String(bMonth).padStart(2, "0")}-${String(bDay).padStart(2, "0")}`;
      const r = await fetch(`${API_BASE}/v1/compatibility`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: personADate, b: bDate }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "error");
      setRes(j);
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setLoading(false); }
  };
  const sel: React.CSSProperties = { background: "#ffffff", color: "#26324d", border: "1px solid #cbd5e8", borderRadius: 6, padding: "6px 8px" };
  return (
    <div style={{ ...cardStyle }}>
      <div style={{ fontSize: 13, color: "#9fb0d8", marginBottom: 8 }}>วันเกิดคนที่ 1 = ดวงด้านบน · กรอกวันเกิดคนที่ 2 เพื่อเทียบ</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={bDay} onChange={(e) => setBDay(+e.target.value)} style={sel}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        <select value={bMonth} onChange={(e) => setBMonth(+e.target.value)} style={sel}>{THAI_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
        <select value={bYear} onChange={(e) => setBYear(+e.target.value)} style={sel}>{Array.from({ length: 121 }, (_, i) => 1917 + i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <button onClick={check} disabled={loading} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer" }}>{loading ? "กำลังเทียบ..." : "เช็กคู่สมพงษ์"}</button>
      </div>
      {err && <div style={{ color: "#ff6b6b", marginTop: 8 }}>{err}</div>}
      {res && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffd23f" }}>{res.compatibility.emoji} เข้ากัน {res.compatibility.percent}%</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{res.compatibility.level}</div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.8 }}>
            <div>นักษัตร {res.a.naksatrName} ↔ {res.b.naksatrName} : <b style={{ color: "#ffd23f" }}>{res.compatibility.naksatrRel}</b></div>
            <div>ธาตุราศี {res.a.rasiElement} ↔ {res.b.rasiElement} : <b style={{ color: "#ffd23f" }}>{res.compatibility.elementRel}</b></div>
            <div>วันเกิด : {res.compatibility.weekdayRel}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 6. จับคู่ดารา/ไอดอล ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");
// เสียงชิมเมื่อผลออก (Web Audio — ไม่ต้องมีไฟล์เสียง) ; โน้ตมากขึ้นตาม %
function CelebMatch({ personADate }: { personADate: string }) {
  const [res, setRes] = useState<CompatResult | null>(null);
  const [celeb, setCeleb] = useState<Celeb | null>(null);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState<Celeb[]>([]);
  const [adding, setAdding] = useState(false);
  const [showList, setShowList] = useState(false);
  const [nName, setNName] = useState("");
  const [nDay, setNDay] = useState(1);
  const [nMonth, setNMonth] = useState(1);
  const [nYear, setNYear] = useState(2000);

  useEffect(() => {
    try { const s = localStorage.getItem("aps_celebs"); if (s) setCustom(JSON.parse(s)); } catch { /* ignore */ }
  }, []);
  const saveCustom = (list: Celeb[]) => {
    setCustom(list);
    try { localStorage.setItem("aps_celebs", JSON.stringify(list)); } catch { /* ignore */ }
  };
  const all = [...CELEBS, ...custom];

  const match = async (c: Celeb) => {
    setLoading(true); setCeleb(c); setRes(null);
    try {
      const r = await fetch(`${API_BASE}/v1/compatibility`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: personADate, b: c.date }),
      });
      const j = await r.json();
      if (r.ok) { setRes(j); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  // สุ่มอ้างอิงรายเดือน: seed = ปี*100 + เดือน (+ แฮชวันเกิด) → ดาราประจำเดือน คงที่ทั้งเดือน เปลี่ยนทุกเดือน
  const monthlyPick = () => {
    const now = new Date();
    let h = now.getFullYear() * 100 + (now.getMonth() + 1);
    for (const ch of personADate) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return CELEBS[h % CELEBS.length]!;
  };
  // จับคู่อัตโนมัติเมื่อกดทำนาย (personADate เปลี่ยน) — ใช้ดาราประจำเดือน
  useEffect(() => { if (personADate) match(monthlyPick()); /* eslint-disable-next-line */ }, [personADate]);
  const [filter, setFilter] = useState("ทั้งหมด");
  const cats = ["ทั้งหมด", ...Array.from(new Set(all.map((c) => c.cat)))];
  const shown = filter === "ทั้งหมด" ? all : all.filter((c) => c.cat === filter);
  const randomMatch = () => match(all[Math.floor(Math.random() * all.length)]!);
  const addCeleb = () => {
    if (!nName.trim()) return;
    const c: Celeb = { name: nName.trim(), date: `${nYear}-${pad2(nMonth)}-${pad2(nDay)}`, emoji: "⭐", cat: "เพิ่มเอง" };
    saveCustom([...custom, c]); setNName(""); setAdding(false); match(c);
  };
  const removeCeleb = (name: string) => saveCustom(custom.filter((c) => c.name !== name));
  const sel: React.CSSProperties = { background: "#ffffff", color: "#26324d", border: "1px solid #cbd5e8", borderRadius: 6, padding: "5px 7px" };

  return (
    <div style={{ ...cardStyle }}>
      {/* ปุ่มเล็กเปิด/ปิดตัวเลือก — ซ่อนทั้งหมดโดยดีฟอลต์ (เหลือแค่ผลจับคู่) */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setShowList((s) => !s)} style={{ background: "#ffffff", color: "#6b7794", border: "1px solid #d5dcea", borderRadius: 14, padding: "3px 12px", cursor: "pointer", fontSize: 12 }}>{showList ? "▲ ปิดตัวเลือก" : "⚙️ ตัวเลือกจับคู่ดารา"}</button>
      </div>
      {showList && (
        <>
          <div style={{ fontSize: 12, color: "#2f6fb0", margin: "8px 0" }}>🗓️ จับคู่ <b>ดาราประจำเดือนนี้</b> ให้อัตโนมัติ — กด 🎲 สุ่มใหม่ หรือเลือกเองได้</div>
          {/* ปุ่มลัด */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ flex: 1 }} />
            <button onClick={randomMatch} disabled={loading} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 14, padding: "4px 13px", cursor: "pointer", fontSize: 12 }}>🎲 สุ่ม</button>
            <button onClick={() => setAdding((s) => !s)} style={{ background: "#eef2f9", color: "#2f6fb0", border: "1px solid #d5dcea", borderRadius: 14, padding: "4px 11px", cursor: "pointer", fontSize: 12 }}>➕ เพิ่มเอง</button>
          </div>
          {/* ตัวกรองหมวด */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            {cats.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)}
                style={{ background: filter === cat ? "#2563eb" : "#ffffff", color: filter === cat ? "#fff" : "#5a6b8a", border: "1px solid #d5dcea", borderRadius: 14, padding: "4px 11px", cursor: "pointer", fontSize: 12, fontWeight: filter === cat ? 700 : 400 }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", maxHeight: 180, overflowY: "auto" }}>
            {shown.map((c) => (
              <span key={c.name} style={{ display: "inline-flex", alignItems: "center", background: celeb?.name === c.name ? "#2563eb" : "#eef2f9", border: "1px solid #d5dcea", borderRadius: 16, overflow: "hidden" }}>
                <button onClick={() => match(c)} disabled={loading}
                  style={{ background: "transparent", color: celeb?.name === c.name ? "#ffffff" : "#26324d", border: "none", padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>
                  {c.emoji} {c.name}
                </button>
                {c.cat === "เพิ่มเอง" && <span onClick={() => removeCeleb(c.name)} title="ลบ" style={{ cursor: "pointer", color: "#ff8a8a", padding: "0 8px 0 2px", fontSize: 13 }}>✕</span>}
              </span>
            ))}
          </div>
        </>
      )}
      {adding && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", background: "#11183300", padding: 0 }}>
          <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="ชื่อดารา" style={{ ...sel, minWidth: 140 }} />
          <select value={nDay} onChange={(e) => setNDay(+e.target.value)} style={sel}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          <select value={nMonth} onChange={(e) => setNMonth(+e.target.value)} style={sel}>{THAI_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
          <select value={nYear} onChange={(e) => setNYear(+e.target.value)} style={sel}>{Array.from({ length: 121 }, (_, i) => 1917 + i).map((yy) => <option key={yy} value={yy}>{yy}</option>)}</select>
          <button onClick={addCeleb} style={{ background: "#37d67a", color: "#04210f", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 700 }}>เพิ่ม + จับคู่</button>
        </div>
      )}
      {loading && <div style={{ marginTop: 10, opacity: 0.7 }}>กำลังจับคู่...</div>}
      {res && celeb && (() => {
        const p = res.compatibility.percent;
        const tier = p >= 90 ? "love" : p >= 65 ? "good" : "low";
        const grad = tier === "love" ? "linear-gradient(100deg,#ffd0dd,#ff5a7a,#ffd23f,#ff5a7a,#ffd0dd)"
          : tier === "good" ? "linear-gradient(100deg,#bfe9ff,#3aa0ff,#e6f5ff,#3aa0ff,#bfe9ff)"
          : "linear-gradient(100deg,#d2d8e6,#8c98ba,#eef1f7,#8c98ba,#d2d8e6)";
        const glow = tier === "love" ? "#ff5a7a" : tier === "good" ? "#3aa0ff" : "#8c98ba";
        const levelCol = tier === "love" ? "#ff8aa8" : tier === "good" ? "#7fd0ff" : "#aab4cc";
        const showSpark = p > 65;
        const confetti = p > 85 ? ["🎉", "✨", "⭐", "🎊", "💛", "💖", "🌟", "🎉", "✨", "⭐", "🎊", "💫"] : [];
        return (
        <div style={{ position: "relative", marginTop: 14, textAlign: "center", padding: "6px 0 12px", overflow: "hidden" }}>
          <style>{`
            @keyframes apsShimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
            @keyframes apsGlow{0%,100%{filter:drop-shadow(0 0 6px var(--aps-glow))}50%{filter:drop-shadow(0 0 26px var(--aps-glow))}}
            @keyframes apsPop{0%{transform:scale(.4);opacity:0}65%{transform:scale(1.18)}100%{transform:scale(1);opacity:1}}
            @keyframes apsTwinkleL{0%,100%{opacity:.25;transform:scale(.7) rotate(0deg)}50%{opacity:1;transform:scale(1.4) rotate(-22deg)}}
            @keyframes apsTwinkleR{0%,100%{opacity:.25;transform:scale(.7) rotate(0deg)}50%{opacity:1;transform:scale(1.4) rotate(22deg)}}
            @keyframes apsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
            @keyframes apsFall{0%{transform:translateY(-30px) rotate(0);opacity:1}100%{transform:translateY(260px) rotate(420deg);opacity:0}}
            .aps-pct{font-size:clamp(56px,13vw,96px);font-weight:900;line-height:1;display:inline-block;vertical-align:middle;margin:0 6px;
              background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
              animation:apsShimmer 2.4s linear infinite,apsGlow 1.7s ease-in-out infinite}
            .aps-sparkL{display:inline-block;font-size:32px;animation:apsTwinkleL 1.2s ease-in-out infinite}
            .aps-sparkR{display:inline-block;font-size:32px;animation:apsTwinkleR 1.2s ease-in-out infinite .4s}
            .aps-pop{animation:apsPop .55s cubic-bezier(.2,1.5,.4,1) both}
            .aps-confetti{position:absolute;top:0;font-size:20px;animation:apsFall linear forwards;pointer-events:none}
          `}</style>
          {confetti.map((c, i) => (
            <span key={i} className="aps-confetti" style={{ left: `${(i * 8.3 + (i % 3) * 4) % 96}%`, animationDuration: `${1.4 + (i % 4) * 0.35}s`, animationDelay: `${(i % 5) * 0.12}s` }}>{c}</span>
          ))}
          <div style={{ fontSize: 26, fontWeight: 800, color: "#2f6fb0" }}>
            <span style={{ color: "#cdd6ee" }}>คุณ</span> <span style={{ color: "#ff8aa8" }}>❤</span> {celeb.emoji} {celeb.name}
          </div>
          <div className="aps-pop" style={{ margin: "6px 0" }}>
            {showSpark && <span className="aps-sparkL" style={{ marginRight: 4 }}>✨</span>}
            <span style={{ fontSize: 42, verticalAlign: "middle" }}>{res.compatibility.emoji}</span>
            <span className="aps-pct" style={{ backgroundImage: grad, ["--aps-glow" as string]: glow } as React.CSSProperties}>{p}%</span>
            {showSpark && <span className="aps-sparkR" style={{ marginLeft: 4 }}>✨</span>}
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: levelCol, animation: "apsFloat 3s ease-in-out infinite" }}>{res.compatibility.level}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 8 }}>
            นักษัตร {res.a.naksatrName}↔{res.b.naksatrName}: {res.compatibility.naksatrRel} · ธาตุ {res.a.rasiElement}↔{res.b.rasiElement}: {res.compatibility.elementRel}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

/* ---------- 7. การ์ดดวงแชร์ได้ ---------- */
const SWATCH: Record<string, string> = {
  แดง: "#e53935", ขาว: "#f5f5f5", ครีม: "#f1e3c0", นวล: "#f1e3c0", เหลือง: "#ffd23f",
  เหลืองอ่อน: "#fff1a8", ส้ม: "#ff8a00", ชมพู: "#ff6f91", เขียว: "#37d67a", ฟ้า: "#4aa3ff",
  น้ำเงิน: "#2563eb", ดำ: "#2b2b2b", ม่วง: "#8e44ad", เทา: "#9aa0b0", รุ้ง: "#a78bfa", ทอง: "#ffce5a",
};
const colorHex = (name: string) => SWATCH[(name || "").split("/")[0]!] ?? "#9fb0d8";
const realmHex = (v: number) => (v >= 9 ? "#37d67a" : v >= 5 ? "#ffd23f" : "#ff6b6b");
const petalGrad = (v: number) => (v >= 9 ? "url(#wpg)" : v >= 5 ? "url(#wpy)" : "url(#wpr)");
// คำทำนายเลขสัมพันธ์ (สั้น) — เลข 5–8 = ระวัง, ที่เหลือ = ส่งเสริมกันดี
const relTone = (v: number, hasWinat = false) => {
  if (hasWinat) { // วินาศ (หายนะ): เลขยิ่งสูงยิ่งต้องระวัง
    if (v >= 9) return { t: "ส่งแรงถึงกัน เรื่องหนึ่งต้องระวังเป็นพิเศษ", s: "ระวังพิเศษ", c: "#ff6b6b" };
    if (v >= 5) return { t: "ส่งแรงถึงกัน เรื่องหนึ่งต้องระวัง", s: "ระวัง", c: "#ff9a8a" };
    return { t: "ส่งแรงถึงกัน เรื่องหนึ่งดีอีกเรื่องดีตาม", s: "ดี", c: "#7ee0a0" };
  }
  return (v >= 5 && v <= 8)
    ? { t: "ผูกกันแรง ควรใช้ความรอบคอบเป็นพิเศษ", s: "ระวัง", c: "#ff9a8a" }
    : { t: "ส่งแรงถึงกัน เรื่องหนึ่งดีอีกเรื่องดีตาม", s: "ดี", c: "#7ee0a0" };
};
const hasWinat = (houses: string[]) => houses.includes("วินาศ");
// คำทำนายเลขภพ (เกณฑ์/ภูมิ ตามค่าเลข)
const realmText = (v: number) => v >= 9
  ? "อยู่ในเกณฑ์ดีมาก ส่งเสริมเรื่องนี้ให้รุ่งเรือง"
  : v >= 5 ? "อยู่ในเกณฑ์ปานกลาง พอไปได้ ใช้ความสามารถของตน"
    : "อยู่ในเกณฑ์ต่ำ ควรระมัดระวังและสร้างเหตุที่ดี";
const realmShort = (v: number) => v >= 9 ? "เกณฑ์ดีมาก" : v >= 5 ? "ปานกลาง" : "เกณฑ์ต่ำ";
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] =>
  [cx + r * Math.cos((deg - 90) * Math.PI / 180), cy + r * Math.sin((deg - 90) * Math.PI / 180)];
const wedgePath = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
};
// รัศมีพระอาทิตย์ (เส้นกระจายจากศูนย์กลาง)
const sunburst = (cx: number, cy: number, r0: number, r1: number, n: number, color: string, op: number, sw = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 360) / n, [x0, y0] = polar(cx, cy, r0, a), [x1, y1] = polar(cx, cy, r1, a);
    return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={sw} opacity={op} />;
  });
// ยันต์ดาว 12 แฉก {12/step}
const starPoly = (cx: number, cy: number, r: number, step: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) { const [x, y] = polar(cx, cy, r, ((i * step) % 12) * 30); pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
  return "M" + pts.join(" L") + " Z";
};
// กลุ่มดาวเชื่อมเส้น
const constLines = (pts: [number, number][], op = 0.45, color = "#bcd2ff") => (
  <g opacity={op}>
    <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={1} />
    {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.5 : 2.4} fill="#fff" />)}
  </g>
);
// ลายกนก/เปลวไทย (เปลวชี้ขึ้นที่ y=0) — dir -1 = พลิกชี้ลง
const flamePath = (u: number, hgt: number) => `M0 0 C ${u * 0.16} ${-hgt * 0.55} ${u * 0.4} ${-hgt} ${u * 0.5} ${-hgt} C ${u * 0.6} ${-hgt} ${u * 0.84} ${-hgt * 0.55} ${u} 0 Z`;
const kanokRow = (x0: number, y: number, width: number, n: number, dir: 1 | -1, fill: string, op = 0.8) => {
  const u = width / n;
  return <g fill={fill} opacity={op}>{Array.from({ length: n }, (_, i) => <path key={i} d={flamePath(u, 13)} transform={`translate(${x0 + i * u} ${y}) scale(1 ${dir})`} />)}</g>;
};
function downloadSvg(svg: SVGSVGElement | null, w: number, h: number, name: string) {
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = w * 2; cv.height = h * 2;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    cv.toBlob((blob) => { if (!blob) return; const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); });
  };
  img.src = url;
}
const VARIANTS = {
  cosmic: { w: 600, h: 854, label: "A · Cosmic Night 🌌" },
  royal: { w: 600, h: 854, label: "B · Royal Gold 👑" },
  pastel: { w: 600, h: 854, label: "C · Pastel Cute 🌸" },
  wheel: { w: 600, h: 854, label: "D · Mandala กลีบบัว ❀" },
} as const;

const TF = "Tahoma, sans-serif";
const SERIF = "Georgia, 'Times New Roman', 'Tahoma', serif";
function ShareCard({ data, variant }: { data: ApiResponse; variant: keyof typeof VARIANTS }) {
  const ref = useRef<SVGSVGElement>(null);
  const { w, h, label } = VARIANTS[variant];
  const b = data.birthInfo, v = data.divination;
  const [, m, d] = data.birth.solarDate.split("-").map(Number);
  const name = data.name || "ดวงของคุณ";
  const dateStr = `${d} ${THAI_MONTHS_FULL[(m! - 1)]} พ.ศ.${b.be}`;
  const heaven = data.natal.filter((n) => n.value >= 9).length;
  const human = data.natal.filter((n) => n.value >= 5 && n.value < 9).length;
  const hell = data.natal.filter((n) => n.value < 5).length;
  // เลขดวงที่ตกซ้ำ ≥2 ภพ (เลขสัมพันธ์) → ไฮไลต์
  const _cnt: Record<number, number> = {};
  data.natal.forEach((n) => { _cnt[n.value] = (_cnt[n.value] || 0) + 1; });
  const rep = new Set(Object.keys(_cnt).filter((k) => _cnt[+k]! >= 2).map(Number));
  const rels = data.repeatedGroups; // เลขสัมพันธ์: [{value, houses[]}]

  let body: React.ReactNode;
  if (variant === "cosmic") {
    const cw = (w - 56 - 14) / 2, ch = 58, ct = 150, cg = 10;
    const chip = (col: number, r: number, icon: string, lb: string, val: string, vc: string, sw?: string) => {
      const cx = 28 + col * (cw + 14), cy = ct + r * (ch + cg);
      return <g key={col + "-" + r}><rect x={cx} y={cy} width={cw} height={ch} rx={13} fill="url(#cchip)" stroke="#ffffff2e" filter="url(#csh)" /><text x={cx + 15} y={cy + 23} fill="#aab6d6" fontSize={12} fontFamily={TF} letterSpacing={0.3}>{icon} {lb}</text><text x={cx + 15} y={cy + 45} fill={vc} fontSize={16.5} fontWeight="bold" fontFamily={TF}>{val}</text>{sw && <circle cx={cx + cw - 21} cy={cy + ch / 2} r={11} fill={sw} stroke="#ffffff88" strokeWidth={1.5} filter="url(#csh)" />}</g>;
    };
    const cX = 30;
    body = <>
      <defs>
        <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0b1026" /><stop offset="45%" stopColor="#221a4a" /><stop offset="100%" stopColor="#0a1230" /></linearGradient>
        <linearGradient id="cgold" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ffe98a" /><stop offset="50%" stopColor="#ffd23f" /><stop offset="100%" stopColor="#ff8a00" /></linearGradient>
        <radialGradient id="cglow" cx="50%" cy="0%" r="70%"><stop offset="0%" stopColor="#6c4bd8" stopOpacity="0.55" /><stop offset="100%" stopColor="#6c4bd8" stopOpacity="0" /></radialGradient>
        <filter id="cfg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="csh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" /></filter>
        <linearGradient id="cchip" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" /><stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" /></linearGradient>
        <radialGradient id="cvig" cx="50%" cy="44%" r="75%"><stop offset="58%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.5" /></radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#cbg)" /><rect width={w} height={360} fill="url(#cglow)" />
      {sunburst(w / 2, 66, 18, 132, 24, "#ffd23f", 0.10)}
      <g opacity={0.16} stroke="#9b7bff" fill="none"><circle cx={w / 2} cy={66} r={86} /><circle cx={w / 2} cy={66} r={110} /><path d={starPoly(w / 2, 66, 110, 5)} /></g>
      {Array.from({ length: 50 }, (_, i) => { const sx = ((i * 137 + 23) % (w - 24)) + 12, sy = ((i * 89 + 41) % (h - 24)) + 12; return <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity={0.18 + (i % 4) * 0.12} />; })}
      {constLines([[34, 46], [74, 78], [56, 118], [112, 100], [74, 78]], 0.4)}
      {constLines([[w - 34, 52], [w - 82, 80], [w - 50, 122], [w - 100, 130]], 0.4)}
      <rect width={w} height={h} fill="url(#cvig)" />
      <rect x={9} y={9} width={w - 18} height={h - 18} rx={18} fill="none" stroke="#ffffff26" strokeWidth={1.5} />
      <rect x={16} y={16} width={w - 32} height={h - 32} rx={14} fill="none" stroke="#ffd23f" strokeWidth={0.8} opacity={0.28} />
      <text x={w / 2} y={58} fill="url(#cgold)" fontSize={27} fontWeight="bold" textAnchor="middle" fontFamily={TF} filter="url(#cfg)" letterSpacing={0.8}>🔮 ดวงชีวิต เลข ๑๒ ตัว</text>
      <text x={w / 2} y={99} fill="#fff" fontSize={28} fontWeight="bold" textAnchor="middle" fontFamily={SERIF} letterSpacing={0.5}>{name}</text>
      <text x={w / 2} y={120} fill="#9fb0d8" fontSize={11} textAnchor="middle" fontFamily={TF} letterSpacing={2}>✦ ✦ ✦</text>
      <text x={w / 2} y={142} fill="#b9c3e0" fontSize={14} textAnchor="middle" fontFamily={TF}>🎂 {dateStr} · วัน{b.weekdayName} · {b.phase} {b.phaseDay} ค่ำ</text>
      {chip(0, 0, "♈", "ราศี", `${v.rasi.name} · ธาตุ${v.rasi.element}`, "#2f6fb0")}
      {chip(1, 0, "🐉", "ปีนักษัตร", `ปี${b.naksatrName}`, "#2f6fb0")}
      {chip(0, 1, "🪐", "ดาวเจ้าวัน", v.taksa.birthPlanet, "#cdb8ff")}
      {chip(1, 1, "🔢", "เลขศาสตร์", `รวม ${v.numerology.sum} · ราก ${v.numerology.root}`, "#cdb8ff")}
      {chip(0, 2, "✅", "สีมงคล", v.taksa.luckColor, "#37d67a", colorHex(v.taksa.luckColor))}
      {chip(1, 2, "⛔", "สีต้องห้าม", v.taksa.avoidColor, "#ff6b6b", colorHex(v.taksa.avoidColor))}
      {chip(0, 3, "🌿", "ธาตุประจำตัว", `${v.elementProfile.rasiElement}+${v.elementProfile.yearElement}`, "#ffd23f")}
      {chip(1, 3, "🧧", "ปีชง", v.chong.status, v.chong.status === "ไม่ชง" ? "#37d67a" : "#ffd23f")}
      <text x={cX} y={444} fill="#cdd6ee" fontSize={16} fontWeight="bold" fontFamily={TF}>🔗 เลขสัมพันธ์ (ภพตกเลขเดียวกัน)</text>
      {rels.length === 0
        ? <text x={cX} y={482} fill="#8794bb" fontSize={13} fontFamily={TF}>— ไม่มีภพที่ตกเลขซ้ำกัน —</text>
        : rels.slice(0, 3).map((g, i) => { const ry = 460 + i * 70, tn = relTone(g.value, hasWinat(g.houses)); return <g key={i}><rect x={28} y={ry} width={w - 56} height={62} rx={11} fill="url(#cchip)" stroke="#ffffff2e" filter="url(#csh)" /><circle cx={54} cy={ry + 23} r={15} fill="#ffd23f" /><text x={54} y={ry + 28} fill="#1a1530" fontSize={14} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{g.value}</text><text x={84} y={ry + 20} fill="#fff" fontSize={14.5} fontWeight="bold" fontFamily={TF}>{g.houses.join("  +  ")}</text><text x={84} y={ry + 39} fill={tn.c} fontSize={11.5} fontFamily={TF}>{tn.t}</text><text x={84} y={ry + 55} fill="#aab6d6" fontSize={11.5} fontFamily={TF}>{realmText(g.value)}</text></g>; })}
      {([["☁️ สวรรค์", heaven, "#37d67a"], ["🧍 มนุษย์", human, "#ffd23f"], ["🔥 นรก", hell, "#ff6b6b"]] as const).map(([t, c, col], i) => { const pw = 170, px = w / 2 - (pw * 3 + 20) / 2 + i * (pw + 10), py = h - 86; return <g key={t}><rect x={px} y={py} width={pw} height={40} rx={20} fill={col + "22"} stroke={col + "66"} /><text x={px + pw / 2} y={py + 26} fill={col} fontSize={15} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{t} {c} ภพ</text></g>; })}
    </>;
  } else if (variant === "royal") {
    const GOLD = "#d8b45a", GOLD2 = "#f0dca0";
    const line = (yy: number, txt: string) => <text x={w / 2} y={yy} fill={GOLD2} fontSize={16} textAnchor="middle" fontFamily={TF}>{txt}</text>;
    const dTH = `${toThaiNum(d!)} ${THAI_MONTHS_FULL[(m! - 1)]} พ.ศ.${toThaiNum(b.be)}`;
    body = <>
      <defs>
        <radialGradient id="rg" cx="50%" cy="22%" r="75%"><stop offset="0%" stopColor="#2a210a" /><stop offset="100%" stopColor="#080606" /></radialGradient>
        <filter id="rfg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width={w} height={h} fill="url(#rg)" />
      {sunburst(w / 2, 104, 16, 150, 28, GOLD, 0.10)}
      <rect x={14} y={14} width={w - 28} height={h - 28} rx={6} fill="none" stroke={GOLD} strokeWidth={2} />
      <rect x={22} y={22} width={w - 44} height={h - 44} rx={4} fill="none" stroke={GOLD + "66"} strokeWidth={1} />
      {[[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]].map(([x, y], i) => <text key={i} x={x} y={y! + 6} fill={GOLD} fontSize={16} textAnchor="middle" fontFamily={TF}>✦</text>)}
      <line x1={w / 2 - 90} y1={62} x2={w / 2 - 18} y2={62} stroke={GOLD} strokeWidth={1} opacity={0.7} /><line x1={w / 2 + 18} y1={62} x2={w / 2 + 90} y2={62} stroke={GOLD} strokeWidth={1} opacity={0.7} />
      <text x={w / 2} y={68} fill={GOLD} fontSize={18} textAnchor="middle" fontFamily={TF}>⟡</text>
      <text x={w / 2} y={116} fill={GOLD2} fontSize={34} fontWeight="bold" textAnchor="middle" fontFamily={SERIF} filter="url(#rfg)" letterSpacing={0.5}>{name}</text>
      <text x={w / 2} y={144} fill={GOLD} fontSize={15} textAnchor="middle" fontFamily={TF}>เลขศาสตร์ ๑๒ ตัว · {dTH}</text>
      <text x={w / 2} y={176} fill={GOLD} fontSize={15} textAnchor="middle" fontFamily={TF}>— ✦ วัน{b.weekdayName} · {b.phase} {toThaiNum(b.phaseDay)} ค่ำ · ปี{b.naksatrName} ✦ —</text>
      {line(228, `ราศี ${v.rasi.name}  ·  ธาตุ ${v.rasi.element}`)}
      {line(266, `ดาวเจ้าวัน ${v.taksa.birthPlanet}  ·  เลขศาสตร์ราก ${toThaiNum(v.numerology.root)}`)}
      {line(304, `ธาตุประจำตัว ${v.elementProfile.rasiElement} + ${v.elementProfile.yearElement}`)}
      <circle cx={w / 2 - 150} cy={340} r={9} fill={colorHex(v.taksa.luckColor)} stroke={GOLD} />
      <text x={w / 2 - 134} y={345} fill={GOLD2} fontSize={15} fontFamily={TF}>สีมงคล {v.taksa.luckColor}</text>
      <circle cx={w / 2 + 30} cy={340} r={9} fill={colorHex(v.taksa.avoidColor)} stroke={GOLD} />
      <text x={w / 2 + 46} y={345} fill={GOLD2} fontSize={15} fontFamily={TF}>ห้าม {v.taksa.avoidColor}</text>
      {line(386, `ปีชง: ${v.chong.status}`)}
      <text x={w / 2} y={418} fill={GOLD} fontSize={18} textAnchor="middle" fontFamily={TF}>— เลขสัมพันธ์ —</text>
      {rels.length === 0
        ? <text x={w / 2} y={456} fill={GOLD2} fontSize={14} textAnchor="middle" fontFamily={TF}>— ไม่มีภพที่ตกเลขซ้ำกัน —</text>
        : rels.slice(0, 3).map((g, i) => { const ry = 438 + i * 68, tn = relTone(g.value, hasWinat(g.houses)); return <g key={i}><rect x={54} y={ry} width={w - 108} height={60} rx={6} fill="#ffd23f1f" stroke={GOLD} /><text x={w / 2} y={ry + 20} fill={GOLD2} fontSize={15} fontWeight="bold" textAnchor="middle" fontFamily={TF}>เลข {toThaiNum(g.value)} · {g.houses.join("  +  ")}</text><text x={w / 2} y={ry + 38} fill={GOLD + "dd"} fontSize={12} textAnchor="middle" fontFamily={TF}>{tn.t}</text><text x={w / 2} y={ry + 53} fill={GOLD + "bb"} fontSize={11.5} textAnchor="middle" fontFamily={TF}>{realmText(g.value)}</text></g>; })}
      <line x1={w / 2 - 120} y1={h - 150} x2={w / 2 - 16} y2={h - 150} stroke={GOLD} strokeWidth={1} opacity={0.55} />
      <text x={w / 2} y={h - 145} fill={GOLD} fontSize={14} textAnchor="middle" fontFamily={TF}>❖</text>
      <line x1={w / 2 + 16} y1={h - 150} x2={w / 2 + 120} y2={h - 150} stroke={GOLD} strokeWidth={1} opacity={0.55} />
      {([["สวรรค์", heaven], ["มนุษย์", human], ["นรก", hell]] as const).map(([t, c], i) => { const pw = 150, px = w / 2 - (pw * 3 + 20) / 2 + i * (pw + 10), py = h - 110; return <g key={t}><rect x={px} y={py} width={pw} height={42} rx={6} fill="#ffffff06" stroke={GOLD} /><text x={px + pw / 2} y={py + 27} fill={GOLD2} fontSize={15} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{t} {toThaiNum(c)} ภพ</text></g>; })}
      <text x={w / 2} y={h - 36} fill={GOLD} fontSize={13} textAnchor="middle" fontFamily={TF}>✦ APS-System ✦</text>
    </>;
  } else if (variant === "pastel") {
    const INK = "#5b4b8a", MUT = "#9a86c0";
    const cw2 = (w - 50 - 16) / 2;
    const relN = Math.min(rels.length, 3);
    const panelH = 44 + (relN ? relN * 66 : 26);
    const cardTop = 206 + panelH + 18;
    const bannerY = cardTop + 74 + 62 + 22;
    const card = (col: number, r: number, icon: string, lb: string, val: string, sw?: string) => { const cx = 25 + col * (cw2 + 16), cy = cardTop + r * 74; return <g key={col + "-" + r}><rect x={cx} y={cy} width={cw2} height={62} rx={16} fill="#ffffffee" filter="url(#psh)" /><text x={cx + 16} y={cy + 25} fill={MUT} fontSize={13} fontFamily={TF}>{icon} {lb}</text><text x={cx + 16} y={cy + 48} fill={INK} fontSize={17} fontWeight="bold" fontFamily={TF}>{val}</text>{sw && <circle cx={cx + cw2 - 22} cy={cy + 31} r={11} fill={sw} stroke="#ffffff" strokeWidth={2} />}</g>; };
    body = <>
      <defs>
        <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#efe6ff" /><stop offset="50%" stopColor="#ffe9f5" /><stop offset="100%" stopColor="#e6f3ff" /></linearGradient>
        <radialGradient id="phalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" /><stop offset="100%" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
        <filter id="pfg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="psh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#9a78d8" floodOpacity="0.35" /></filter>
      </defs>
      <rect width={w} height={h} fill="url(#pbg)" />
      <ellipse cx={w / 2} cy={58} rx={250} ry={60} fill="url(#phalo)" />
      <rect x={10} y={10} width={w - 20} height={h - 20} rx={22} fill="none" stroke="#ffffff" strokeWidth={3} />
      {[[40, 130, 18], [w - 46, 150, 14], [50, h - 120, 13], [w - 40, h - 150, 16]].map(([x, y, s], i) => <text key={i} x={x} y={y} fill="#caa6ff" fontSize={s} opacity={0.7} fontFamily={TF}>✨</text>)}
      <text x={44} y={70} fontSize={26} fontFamily={TF}>🌙</text>
      <text x={w / 2} y={64} fill={INK} fontSize={26} fontWeight="bold" textAnchor="middle" fontFamily={TF} filter="url(#pfg)">{`🌸 ${data.name ? "ดวงของ " + data.name : "ดวงชะตาของคุณ"} 🌸`}</text>
      <text x={w / 2} y={94} fill={MUT} fontSize={15} textAnchor="middle" fontFamily={TF}>🎂 {dateStr} · วัน{b.weekdayName}</text>
      <rect x={25} y={120} width={(w - 60) / 2} height={70} rx={18} fill="#e7d8ff" filter="url(#psh)" />
      <text x={25 + (w - 60) / 4} y={152} fill={INK} fontSize={15} textAnchor="middle" fontFamily={TF}>♈ ราศี</text>
      <text x={25 + (w - 60) / 4} y={178} fill={INK} fontSize={20} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{v.rasi.name}</text>
      <rect x={w / 2 + 5} y={120} width={(w - 60) / 2} height={70} rx={18} fill="#ffd9ec" filter="url(#psh)" />
      <text x={w / 2 + 5 + (w - 60) / 4} y={152} fill={INK} fontSize={15} textAnchor="middle" fontFamily={TF}>🐉 ปีนักษัตร</text>
      <text x={w / 2 + 5 + (w - 60) / 4} y={178} fill={INK} fontSize={20} fontWeight="bold" textAnchor="middle" fontFamily={TF}>ปี{b.naksatrName}</text>
      <rect x={25} y={206} width={w - 50} height={panelH} rx={18} fill="#ffffffee" filter="url(#psh)" />
      <text x={w / 2} y={232} fill={INK} fontSize={16} fontWeight="bold" textAnchor="middle" fontFamily={TF}>🔗 เลขสัมพันธ์ (ภพตกเลขเดียวกัน)</text>
      {rels.length === 0
        ? <text x={w / 2} y={262} fill={MUT} fontSize={13} textAnchor="middle" fontFamily={TF}>— ไม่มีภพที่ตกเลขซ้ำกัน —</text>
        : rels.slice(0, 3).map((g, i) => { const ry = 248 + i * 66, tn = relTone(g.value, hasWinat(g.houses)), tc = tn.s === "ดี" ? "#2e8b57" : "#c2487a"; return <g key={i}><circle cx={56} cy={ry + 16} r={15} fill={realmHex(g.value)} /><text x={56} y={ry + 21} fill="#fff" fontSize={14} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{g.value}</text><text x={88} y={ry + 12} fill={INK} fontSize={15} fontWeight="bold" fontFamily={TF}>{g.houses.join("  +  ")}</text><text x={88} y={ry + 31} fill={tc} fontSize={11.5} fontFamily={TF}>{tn.t}</text><text x={88} y={ry + 48} fill={MUT} fontSize={11.5} fontFamily={TF}>{realmText(g.value)}</text></g>; })}
      {card(0, 0, "✅", "สีมงคล", v.taksa.luckColor, colorHex(v.taksa.luckColor))}
      {card(1, 0, "⛔", "สีต้องห้าม", v.taksa.avoidColor, colorHex(v.taksa.avoidColor))}
      {card(0, 1, "🔢", "เลขนำโชค", `ราก ${v.numerology.root}`)}
      {card(1, 1, "🧧", "ปีชง", v.chong.status)}
      <rect x={60} y={bannerY} width={w - 120} height={48} rx={24} fill="#6b4ea8" filter="url(#psh)" />
      <text x={w / 2} y={bannerY + 31} fill="#fff" fontSize={18} fontWeight="bold" textAnchor="middle" fontFamily={TF}>✨ ดวงปัง! สายมูห้ามพลาด ✨</text>
      <text x={w / 2} y={h - 26} fill={MUT} fontSize={13} textAnchor="middle" fontFamily={TF}>♡ APS-System · ดวงชีวิต ๑๒ ตัว ♡</text>
    </>;
  } else {
    const cx = w / 2, cy = 326, circR = 80;
    // กลีบบัว: ฐานมนด้านใน (r0) ปลายแหลมพุ่งออกนอก — สูง=lenPx, กว้าง=halfW*2 (พิกเซล)
    const petal = (r0: number, lenPx: number, a: number, halfW: number) => {
      const ux = Math.cos((a - 90) * Math.PI / 180), uy = Math.sin((a - 90) * Math.PI / 180);
      const vx = -uy, vy = ux;
      const bx = cx + r0 * ux, by = cy + r0 * uy;
      const pt = (al: number, pe: number) => `${(bx + al * ux + pe * vx).toFixed(1)} ${(by + al * uy + pe * vy).toFixed(1)}`;
      const L = lenPx;
      return `M${pt(L, 0)} C${pt(L * 0.92, -halfW * 0.18)} ${pt(L * 0.3, -halfW)} ${pt(0, -halfW * 0.45)} Q${pt(-L * 0.07, 0)} ${pt(0, halfW * 0.45)} C${pt(L * 0.3, halfW)} ${pt(L * 0.92, halfW * 0.18)} ${pt(L, 0)} Z`;
    };
    body = <>
      <defs>
        <radialGradient id="wbg" cx="50%" cy="40%" r="75%"><stop offset="0%" stopColor="#241a52" /><stop offset="60%" stopColor="#100b2c" /><stop offset="100%" stopColor="#070514" /></radialGradient>
        <radialGradient id="worb" cx="50%" cy="42%" r="60%"><stop offset="0%" stopColor="#3a2e7a" /><stop offset="65%" stopColor="#140d34" /><stop offset="100%" stopColor="#0a0820" /></radialGradient>
        <radialGradient id="whalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#7c5cff" stopOpacity="0.55" /><stop offset="100%" stopColor="#7c5cff" stopOpacity="0" /></radialGradient>
        <linearGradient id="wgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff0b0" /><stop offset="45%" stopColor="#f5c64a" /><stop offset="100%" stopColor="#b8841f" /></linearGradient>
        <linearGradient id="wpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#62e08e" /><stop offset="100%" stopColor="#1c8246" /></linearGradient>
        <linearGradient id="wpy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe390" /><stop offset="100%" stopColor="#d99f28" /></linearGradient>
        <linearGradient id="wpr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff897c" /><stop offset="100%" stopColor="#cf3636" /></linearGradient>
        <filter id="wfg" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="wfg2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="wvig" cx="50%" cy="44%" r="72%"><stop offset="60%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.5" /></radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#wbg)" />
      {Array.from({ length: 46 }, (_, i) => { const sx = ((i * 151 + 19) % (w - 20)) + 10, sy = ((i * 97 + 33) % (h - 20)) + 10; return <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 1.5 : 0.9} fill="#fff" opacity={0.16 + (i % 3) * 0.12} />; })}
      {constLines([[40, 96], [92, 130], [70, 184], [126, 198], [92, 130]], 0.42)}
      {constLines([[w - 40, 104], [w - 96, 138], [w - 64, 190], [w - 120, 150]], 0.42)}
      {constLines([[44, h - 150], [96, h - 116], [78, h - 64]], 0.36)}
      {constLines([[w - 48, h - 158], [w - 104, h - 120], [w - 72, h - 70]], 0.36)}
      <rect width={w} height={h} fill="url(#wvig)" />
      <rect x={9} y={9} width={w - 18} height={h - 18} rx={16} fill="none" stroke="#ffd23f" strokeWidth={1} opacity={0.4} />
      <text x={cx} y={50} fill="url(#wgold)" fontSize={24} fontWeight="bold" textAnchor="middle" fontFamily={TF} filter="url(#wfg2)" letterSpacing={0.8}>❀ ดอกบัวชีวิต ๑๒ ภพ ❀</text>
      <circle cx={cx} cy={cy} r={224} fill="url(#whalo)" />
      {sunburst(cx, cy, circR + 4, circR + 108, 48, "#ffd23f", 0.1, 1)}
      {/* กลีบทอง (ชั้นหลัง) — เริ่มนอกวงแหวน เป็นขอบทองอวบ */}
      {Array.from({ length: 12 }, (_, i) => { const a = i * 30; return <path key={"gp" + i} d={petal(circR + 6, 130, a, 45)} fill="url(#wgold)" stroke="#8a6418" strokeWidth={1} />; })}
      {/* กลีบสีตามภูมิ (ชั้นหน้า) ไล่เฉด 3D + ขอบทอง + เลขใหญ่ — สูง 120 */}
      {data.natal.map((n, i) => { const ir = rep.has(n.value), a = i * 30; const [vx, vy] = polar(cx, cy, circR + 62, a); const [nx, ny] = polar(cx, cy, circR + 146, a); return <g key={i}><path d={petal(circR + 11, 120, a, 45)} fill={petalGrad(n.value)} stroke={ir ? "#fff7d6" : "url(#wgold)"} strokeWidth={ir ? 3 : 2} filter={ir ? "url(#wfg2)" : undefined} /><text x={vx} y={vy + 9} fill="#fff" fontSize={25} fontWeight="bold" textAnchor="middle" fontFamily={SERIF} filter="url(#wfg2)">{n.value}</text><text x={nx} y={ny + 3} fill={ir ? "#ffd23f" : "#e7deff"} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{ir ? "★" : ""}{n.name}</text></g>; })}
      {/* วงกลมใหญ่กลางดอก — วงทองหนา 2 ชั้น */}
      <circle cx={cx} cy={cy} r={circR + 5} fill="none" stroke="url(#wgold)" strokeWidth={7} filter="url(#wfg)" />
      <circle cx={cx} cy={cy} r={circR} fill="url(#worb)" stroke="#5a4410" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={circR - 8} fill="none" stroke="#ffe9a8" strokeWidth={1} opacity={0.45} />
      <text x={cx} y={cy - 28} fill="#ffd23f" fontSize={20} textAnchor="middle" fontFamily={TF}>❀</text>
      <text x={cx} y={cy + 4} fill="#fff" fontSize={22} fontWeight="bold" textAnchor="middle" fontFamily={SERIF} filter="url(#wfg2)">{name}</text>
      <text x={cx} y={cy + 30} fill="#cdb8ff" fontSize={12} textAnchor="middle" fontFamily={TF}>{v.rasi.name} · ปี{b.naksatrName}</text>
      <text x={cx} y={cy + 50} fill="#9aa0c8" fontSize={11} textAnchor="middle" fontFamily={TF}>{toThaiNum(d!)} {THAI_MONTHS_FULL[(m! - 1)]} พ.ศ.{toThaiNum(b.be)}</text>
      {([["#37d67a", "ดี·สวรรค์"], ["#ffd23f", "กลาง·มนุษย์"], ["#ff6b6b", "ระวัง·นรก"]] as const).map(([c, t], i) => { const gw = 150, gx = cx - (gw * 3) / 2 + i * gw + 18; return <g key={t}><circle cx={gx} cy={566} r={6} fill={c} /><text x={gx + 12} y={570} fill="#cdd6ee" fontSize={12} fontFamily={TF}>{t}</text></g>; })}
      <circle cx={cx - 150} cy={592} r={9} fill={colorHex(v.taksa.luckColor)} stroke="#fff5" />
      <text x={cx - 134} y={597} fill="#37d67a" fontSize={14} fontFamily={TF}>มงคล {v.taksa.luckColor}</text>
      <circle cx={cx + 20} cy={592} r={9} fill={colorHex(v.taksa.avoidColor)} stroke="#fff5" />
      <text x={cx + 36} y={597} fill="#ff6b6b" fontSize={14} fontFamily={TF}>ห้าม {v.taksa.avoidColor}</text>
      <text x={cx} y={624} fill="#ffd23f" fontSize={14} textAnchor="middle" fontFamily={TF}>เลขศาสตร์ ราก {toThaiNum(v.numerology.root)} · ปีชง {v.chong.status}</text>
      <rect x={42} y={642} width={w - 84} height={94} rx={12} fill="#ffffff08" stroke="#ffd23f55" />
      <text x={cx} y={664} fill="#ffd23f" fontSize={15} fontWeight="bold" textAnchor="middle" fontFamily={TF}>🔗 เลขสัมพันธ์ (ภพตกเลขเดียวกัน)</text>
      {rels.length === 0
        ? <text x={cx} y={694} fill="#e8ecf5" fontSize={13} textAnchor="middle" fontFamily={TF}>— ไม่มีภพที่ตกเลขซ้ำ —</text>
        : rels.slice(0, 3).map((g, i) => { const tn = relTone(g.value, hasWinat(g.houses)); return <text key={i} x={cx} y={688 + i * 22} fill="#e8ecf5" fontSize={12.5} textAnchor="middle" fontFamily={TF}>เลข {toThaiNum(g.value)}: {g.houses.join("+")} <tspan fill={tn.c} fontWeight="bold">({tn.s} · {realmShort(g.value)})</tspan></text>; })}
      {([["☁️ สวรรค์", heaven, "#37d67a"], ["🧍 มนุษย์", human, "#ffd23f"], ["🔥 นรก", hell, "#ff6b6b"]] as const).map(([t, c, col], i) => { const pw = 168, px = w / 2 - (pw * 3 + 20) / 2 + i * (pw + 10), py = 760; return <g key={t}><rect x={px} y={py} width={pw} height={40} rx={20} fill={col + "22"} stroke={col + "66"} /><text x={px + pw / 2} y={py + 26} fill={col} fontSize={15} fontWeight="bold" textAnchor="middle" fontFamily={TF}>{t} {toThaiNum(c)} ภพ</text></g>; })}
    </>;
  }

  return (
    <div style={{ ...cardStyle, padding: 10 }}>
      <div style={{ fontSize: 13, color: "#2f6fb0", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ overflowX: "auto" }}>
        <svg ref={ref} width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%", height: "auto", borderRadius: 16 }}>{body}</svg>
      </div>
      <button onClick={() => downloadSvg(ref.current, w, h, `ดวง-${variant}-${data.name || "ดวง"}.png`)} style={{ marginTop: 8, width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📥 บันทึก PNG</button>
    </div>
  );
}
function ShareCards({ data }: { data: ApiResponse }) {
  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      <ShareCard data={data} variant="wheel" />
    </div>
  );
}

/* ---------- 1. ตารางฐาน ---------- */
function BaseTable({ rows, natal, light }: { rows: ReturnType<typeof decompose>; natal: Natal[]; light?: boolean }) {
  const bd = light ? "#d5dcea" : "#2c3658";
  const td: React.CSSProperties = { ...baseCell, width: COL, height: 26, fontSize: 13, borderLeftColor: bd, borderTopColor: bd, color: light ? "#2b3a5a" : undefined, background: light ? "#ffffff" : undefined };
  const lbl: React.CSSProperties = { ...td, width: LBL, textAlign: "right", paddingRight: 6, color: light ? "#5a6b8a" : "#9fb0d8", background: light ? "#eef2f9" : "#161d35" };
  const tbl: React.CSSProperties = { ...tableStyle(GRID_W + RGT), borderRightColor: bd, borderBottomColor: bd };
  return (
    <table style={tbl}>
      <tbody>
        <tr><td style={lbl}>ฐานวัน</td>{rows.map((r, i) => <td key={i} style={td}>{r.dayB ?? ""}</td>)}
          <td rowSpan={6} style={{ ...td, width: RGT, color: light ? "#2b5cab" : "#2f6fb0", fontWeight: 700, verticalAlign: "middle", background: light ? "#eef2f9" : "#161d35" }}>ตารางกราฟชีวิต</td></tr>
        <tr><td style={lbl}>ฐานเดือน</td>{rows.map((r, i) => <td key={i} style={td}>{r.monthB}</td>)}</tr>
        <tr><td style={lbl}>ฐานปี</td>{rows.map((r, i) => <td key={i} style={td}>{r.yearB}</td>)}</tr>
        <tr><td style={lbl}>ผลรวม</td>{rows.map((r, i) => <td key={i} style={{ ...td, color: light ? "#8a95ad" : "#7b88ad" }}>{r.sum}</td>)}</tr>
        <tr><td style={{ ...lbl, fontWeight: 700 }}>เลขดวง</td>{rows.map((r, i) => <td key={i} style={{ ...td, fontWeight: 700, background: light ? "#eaf0fb" : "#1c274a", color: light ? "#2b5cab" : "#2f6fb0" }}>{r.total}</td>)}</tr>
        <tr><td style={lbl}>วิธีชีวิต</td>{natal.map((n) => <td key={n.no} style={{ ...td, color: light ? "#2f9e57" : "#9fb0d8", fontSize: 10 }}>{n.name}</td>)}</tr>
      </tbody>
    </table>
  );
}

/* ---------- 2. กราฟชีวิต (ยึดคอลัมน์รอบ 12 ปี ให้ตรงตารางบน/ล่าง) ---------- */
/* ---------- 2a. ไทม์ไลน์ชีวิต (แนวตั้ง สลับซ้าย-ขวา) ---------- */
function LifeTimelineV({ natal, base12, centerAge, curAge, birthYear }: { natal: Natal[]; base12: number[]; centerAge: number; curAge: number; birthYear: number }) {
  const W = GRID_W + RGT, spineX = W / 2;
  const iconOff = 330;
  const itemH = 90, top = 22;
  const H = top + 12 * itemH + 8;
  let rowStart = centerAge - (((centerAge - 1) % 12 + 12) % 12);
  while (rowStart < 1) rowStart += 12;
  const ages = Array.from({ length: 12 }, (_, i) => rowStart + i);
  // ภพของอายุ = natal[(age-1)%12] (ตรงกับ residue ในกราฟเส้น) → value/name/text มาจากห้องเดียวกัน
  const houseOf = (age: number) => natal[(((age - 1) % 12) + 12) % 12];
  const yAt = (k: number) => top + k * itemH + itemH / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto", maxWidth: "100%", background: "#ffffff", borderRadius: 10 }}>
      <defs>
        <linearGradient id="tlvspine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#39b6e6" /><stop offset="50%" stopColor="#9a63e0" /><stop offset="100%" stopColor="#ff6b9d" />
        </linearGradient>
      </defs>
      <line x1={spineX} y1={yAt(0)} x2={spineX} y2={yAt(11)} stroke="url(#tlvspine)" strokeWidth={4} strokeLinecap="round" />
      {ages.map((age, k) => {
        const house = houseOf(age), v = house?.value ?? 0, c = realmHex(v), name = house?.name ?? "", year = birthYear + age + 543;
        const isP = age === curAge + 1, isC = age === centerAge;
        const L = k % 2 === 0, y = yAt(k);
        const iconX = L ? spineX - iconOff : spineX + iconOff, connX = L ? iconX + 20 : iconX - 20;
        // ฝั่งบับเบิล (นอก) = ชื่อภพ+อายุ · ฝั่งเส้นกลาง (ใน) = พ.ศ. — สลับมิเรอร์ซ้าย/ขวา
        const tx = L ? iconX + 26 : iconX - 26, anc = L ? "start" as const : "end" as const;
        const yx = L ? spineX - 24 : spineX + 24, yanc = L ? "end" as const : "start" as const;
        return (
          <g key={k}>
            <line x1={spineX} y1={y} x2={connX} y2={y} stroke={c} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.8} />
            <circle cx={spineX} cy={y} r={6} fill={c} stroke="#ffffff" strokeWidth={2} />
            {/* ชื่อภพ + อายุ (ฝั่งบับเบิล) */}
            <text x={tx} y={y - 9} fill={isP ? "#b07d12" : c} fontSize={17} fontWeight={700} textAnchor={anc} fontFamily={TF}>{name}</text>
            <text x={tx} y={y +12} fill="#5a6b8a" fontSize={10} textAnchor={anc} fontFamily={TF}>อายุ {age} · {realmShort(v)}{isP ? " ⛳" : ""}</text>
            {/* พ.ศ. (ฝั่งเส้นกลาง) */}
            <text x={yx} y={y - 3} fill="#26324d" fontSize={12} fontWeight={700} textAnchor={yanc} fontFamily={TF}>{year}</text>
            {/* คำทำนายของห้องที่ปีนั้นตก (จาก natal[].text) — บรรทัดเดียว */}
            <text x={tx} y={y + 28} fill="#6b7794" fontSize={11} textAnchor={anc} fontFamily={TF}>{house?.text ?? ""}</text>
            {(isP || isC) && <circle cx={iconX} cy={y} r={23} fill="none" stroke={isP ? "#e0a31f" : "#2f6fb0"} strokeWidth={2} opacity={0.9} />}
            <circle cx={iconX} cy={y} r={18} fill="#ffffff" stroke={c} strokeWidth={2} />
            <text x={iconX} y={y + 6} fill={c} fontSize={18} fontWeight={700} textAnchor="middle" fontFamily={TF}>{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- 2b. ไทม์ไลน์ชีวิต (งูเลื้อย serpentine) ---------- */
function LifeTimeline({ natal, base12, centerAge, curAge, birthYear }: { natal: Natal[]; base12: number[]; centerAge: number; curAge: number; birthYear: number }) {
  const W = GRID_W + RGT;
  const perRow = 4, rows = 3;
  const padX = 78, padTop = 40, rowH = 154;
  const H = padTop + rows * rowH + 30;
  const colW = (W - 2 * padX) / perRow;
  const xCol = (c: number) => padX + (c + 0.5) * colW;
  const rowY = (r: number) => padTop + r * rowH + rowH / 2;
  const R = rowH / 2;
  const xL = xCol(0), xR = xCol(perRow - 1);
  let rowStart = centerAge - (((centerAge - 1) % 12 + 12) % 12);
  while (rowStart < 1) rowStart += 12;
  const ages = Array.from({ length: 12 }, (_, i) => rowStart + i);
  const valOf = (age: number) => base12[((age % 12) + 12) % 12]!;
  const sx = 38, ex = W - 38;
  // เส้นทางงูเลื้อย: แถว0 ซ้าย→ขวา, โค้งลงขวา, แถว1 ขวา→ซ้าย, โค้งลงซ้าย, แถว2 ซ้าย→ขวา
  const d = `M ${sx} ${rowY(0)} L ${xR} ${rowY(0)} A ${R} ${R} 0 0 1 ${xR} ${rowY(1)} L ${xL} ${rowY(1)} A ${R} ${R} 0 0 0 ${xL} ${rowY(2)} L ${ex} ${rowY(2)}`;
  const nodes = ages.map((age, k) => {
    const row = Math.floor(k / perRow), pos = k % perRow;
    const col = row % 2 === 0 ? pos : perRow - 1 - pos;
    return { age, k, x: xCol(col), y: rowY(row), v: valOf(age) };
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", background: "#ffffff", borderRadius: 10 }}>
      <defs>
        <linearGradient id="tlpath" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0a81f" /><stop offset="33%" stopColor="#ff6b9d" />
          <stop offset="66%" stopColor="#39b6e6" /><stop offset="100%" stopColor="#9a63e0" />
        </linearGradient>
        <filter id="tlglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <path d={d} fill="none" stroke="url(#tlpath)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      {/* บับเบิลเริ่ม/จบ */}
      <circle cx={sx} cy={rowY(0)} r={26} fill="#ffffff" stroke="#e0a31f" strokeWidth={2} />
      <text x={sx} y={rowY(0) - 1} fill="#b07d12" fontSize={11} fontWeight={700} textAnchor="middle" fontFamily={TF}>เริ่ม</text>
      <text x={sx} y={rowY(0) + 12} fill="#5a6b8a" fontSize={9} textAnchor="middle" fontFamily={TF}>{birthYear + ages[0]! + 543}</text>
      <circle cx={ex} cy={rowY(2)} r={26} fill="#ffffff" stroke="#8a5fd0" strokeWidth={2} />
      <text x={ex} y={rowY(2) - 1} fill="#7a52c0" fontSize={11} fontWeight={700} textAnchor="middle" fontFamily={TF}>อนาคต</text>
      <text x={ex} y={rowY(2) + 12} fill="#5a6b8a" fontSize={9} textAnchor="middle" fontFamily={TF}>{birthYear + ages[11]! + 543}</text>
      {nodes.map(({ age, k, x: nx, y: ny, v }) => {
        const c = realmHex(v), name = natal[12 - v]?.name ?? "", year = birthYear + age + 543;
        const isP = age === curAge + 1, isC = age === centerAge;
        const s = k % 2 === 0 ? -1 : 1, ts = -s, by = ny + s * 52;
        return (
          <g key={k}>
            <line x1={nx} y1={ny + s * 9} x2={nx} y2={ny + s * 32} stroke={c} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.85} />
            {(isP || isC) && <circle cx={nx} cy={by} r={23} fill="none" stroke={isP ? "#e0a31f" : "#2f6fb0"} strokeWidth={2} opacity={0.9} />}
            <circle cx={nx} cy={by} r={18} fill="#ffffff" stroke={c} strokeWidth={2} />
            <text x={nx} y={by + 6} fill={c} fontSize={18} fontWeight={700} textAnchor="middle" fontFamily={TF}>{v}</text>
            <circle cx={nx} cy={ny} r={5} fill={c} stroke="#ffffff" strokeWidth={1.5} />
            <text x={nx} y={ny + ts * 15} fill={isP ? "#b07d12" : c} fontSize={19} fontWeight={700} textAnchor="middle" fontFamily={TF}>{year}</text>
            <text x={nx} y={ny + ts * 31} fill="#26324d" fontSize={11.5} fontWeight={700} textAnchor="middle" fontFamily={TF}>{name}</text>
            <text x={nx} y={ny + ts * 44} fill="#5a6b8a" fontSize={9.5} textAnchor="middle" fontFamily={TF}>อายุ {age} · {realmShort(v)}{isP ? " ⛳" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- 2c. กราฟพยากรณ์เต็มรูปแบบ (ธีมสว่าง · ดาวทองสูงสุด/ต่ำสุด · ป้ายปีเลขไทย) ---------- */
function LifeChartFull({ natal, base12, centerAge, curAge, birthYear, birthLunarMonth }: { natal: Natal[]; base12: number[]; centerAge: number; curAge: number; birthYear: number; birthLunarMonth: number }) {
  const W = GRID_W + RGT, H = 600, T = 30, Bm = 30;
  const gy0 = T, gy1 = H - Bm, gx0 = LBL, gx1 = GRID_W, plotW = gx1 - gx0;
  let rowStart = centerAge - (((centerAge - 1) % 12 + 12) % 12);
  while (rowStart < 1) rowStart += 12;
  const ages = Array.from({ length: 12 }, (_, i) => rowStart + i);
  const valOf = (age: number) => base12[((age % 12) + 12) % 12]!;
  const cw = plotW / 12, x = (i: number) => gx0 + (i + 0.5) * cw;
  const chH = (gy1 - gy0) / 12, y = (v: number) => gy0 + (12 - v + 0.5) * chH;
  const aLast = ages[ages.length - 1]!;
  const pts: [number, number][] = [
    [gx0, y(birthLunarMonth)],
    ...ages.map((a, i) => [x(i), y(valOf(a))] as [number, number]),
    [gx1, y((valOf(aLast) + valOf(aLast + 1)) / 2)],
  ];
  const path = smoothPath(pts);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto", maxWidth: "100%", background: "#ffffff" }}>
      {/* 3 โซนสีตั้ง: ต้น(ครีม) · กลาง(เขียว) · ปลาย(ฟ้า) */}
      <rect x={gx0} y={gy0} width={4 * cw} height={gy1 - gy0} fill="#fcf3e1" />
      <rect x={gx0 + 4 * cw} y={gy0} width={4 * cw} height={gy1 - gy0} fill="#e9f5ea" />
      <rect x={gx0 + 8 * cw} y={gy0} width={4 * cw} height={gy1 - gy0} fill="#eaf0fb" />
      {/* เส้นกริดแนวนอน + ตัวเลขค่า 1–12 (ซ้าย) + ชื่อภพ (ขวา) */}
      {Array.from({ length: 13 }, (_, k) => (
        <line key={"h" + k} x1={gx0} y1={gy0 + k * chH} x2={gx1} y2={gy0 + k * chH} stroke={k % 4 === 0 ? "#cdd6e6" : "#e7ecf4"} />
      ))}
      {Array.from({ length: 13 }, (_, i) => <line key={"v" + i} x1={gx0 + i * cw} y1={gy0} x2={gx0 + i * cw} y2={gy1} stroke="#e7ecf4" />)}
      {Array.from({ length: 12 }, (_, row) => {
        const v = 12 - row, yc = gy0 + (row + 0.5) * chH, h = natal[row];
        return (
          <g key={v}>
            <text x={gx0 - 10} y={yc + 4} fill="#7a88a8" fontSize={13} textAnchor="end" fontFamily={TF}>{v}</text>
            {h && <text x={gx1 + 10} y={yc + 4} fill="#2f9e57" fontSize={13} fontFamily={TF}>{h.name}</text>}
          </g>
        );
      })}
      {/* เส้นกราฟเขียวหนา */}
      <path d={path} fill="none" stroke="#2f9e57" strokeWidth={4} strokeLinecap="round" />
      {/* จุด · % · ดาวทอง · ป้ายปี */}
      {ages.map((age, i) => {
        const v = valOf(age), px = x(i), py = y(v), isCur = age === curAge + 1, isCenter = age === centerAge;
        const above = v >= 7, fy = above ? py - 58 : py + 16; // มุมบนป้าย
        return (
          <g key={i}>
            <text x={px} y={above ? py - 12 : py + 18} fill="#2f9e57" fontSize={12} fontWeight={700} textAnchor="middle" fontFamily={TF}>{toThaiNum(Math.floor((v / 12) * 100))}%</text>
            <circle cx={px} cy={py} r={5} fill="#e23b3b" stroke="#fff" strokeWidth={1.5} />
            {/* ป้ายปี (กรอบขาว) */}
            <g>
              <rect x={px - 34} y={fy} width={68} height={34} rx={6} fill="#ffffff" stroke={isCur ? "#e0a31f" : isCenter ? "#3b82c4" : "#cdd6e6"} strokeWidth={isCur || isCenter ? 2 : 1} />
              <text x={px} y={fy + 15} fill="#2b5cab" fontSize={13} fontWeight={700} textAnchor="middle" fontFamily={TF}>พ.ศ.{toThaiNum(birthYear + age + 543)}</text>
              <text x={px} y={fy + 28} fill="#8794ad" fontSize={11} textAnchor="middle" fontFamily={TF}>อายุ {toThaiNum(age)}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function LifeGraph({ natal, base12, centerAge, curAge, birthYear, birthLunarMonth }: { natal: Natal[]; base12: number[]; centerAge: number; curAge: number; birthYear: number; birthLunarMonth: number }) {
  const H = 410, T = 22, Bm = 52;
  const gy0 = T, gy1 = H - Bm;
  const gx0 = LBL, gx1 = GRID_W, plotW = gx1 - gx0;
  // ยึดคอลัมน์ตาม "รอบ 12 ปี" ให้ตรงตารางบน(ภพ)/ล่าง(เดือน-นักษัตร-พ.ศ.)
  // rowStart ≡ 1 (mod 12) = อายุต้นรอบที่ครอบ centerAge → col0 = ภพ1/วาสนา (residue 1)
  // ทำให้ "ปักธง" (curAge+1) ตกคอลัมน์ตรงช่องตารางเป๊ะ
  let rowStart = centerAge - (((centerAge - 1) % 12 + 12) % 12);
  while (rowStart < 1) rowStart += 12;
  const ages = Array.from({ length: 12 }, (_, i) => rowStart + i);
  const valOf = (age: number) => base12[((age % 12) + 12) % 12]!;
  const cw = plotW / ages.length; // ความกว้างต่อช่อง (คอลัมน์)
  const x = (i: number) => gx0 + (i + 0.5) * cw; // จุดอยู่ "กลางช่อง" (cell center)
  const chH = (gy1 - gy0) / 12; // ความสูงต่อช่องค่า (12 ช่อง: ค่า 1..12)
  const y = (v: number) => gy0 + (12 - v + 0.5) * chH; // ค่า v อยู่ "กลางช่อง" ของแถวนั้น
  // เส้นเริ่มจากขอบซ้าย → ผ่านกลางช่องทุกจุด → จบขอบขวา
  // ขอบซ้าย "เริ่มลากจากฐานเดือน" = ค่าเดือนจันทรคติเกิด (ฐานเดือน[0]) แล้วลากเข้าจุดแรก
  // ขอบขวา = กึ่งกลางระหว่างจุดท้ายกับเพื่อนบ้านนอกจอ (ค่อยลากออก)
  const aLast = ages[ages.length - 1]!;
  const pts: [number, number][] = [
    [gx0, y(birthLunarMonth)],
    ...ages.map((a, i) => [x(i), y(valOf(a))] as [number, number]),
    [gx1, y((valOf(aLast) + valOf(aLast + 1)) / 2)],
  ];
  const path = smoothPath(pts);

  return (
    <svg width={GRID_W + RGT} height={H} style={{ display: "block", background: "#ffffff" }}>
      {/* กรอบนอก + เส้นแบ่งคอลัมน์ (ให้ตรงกับตาราง) */}
      <rect x={0.5} y={0.5} width={GRID_W + RGT - 1} height={H - 1} fill="none" stroke="#cdd6e6" />
      <line x1={LBL} y1={0} x2={LBL} y2={H} stroke="#cdd6e6" />
      <line x1={GRID_W} y1={0} x2={GRID_W} y2={H} stroke="#cdd6e6" />
      {/* 3 แถบภูมิ คร่อมกลุ่มละ 4 ช่อง: สวรรค์(12–9) / มนุษย์(8–5) / นรก(4–1) */}
      {([
        ["สวรรค์ภูมิ", gy0 + 2 * chH, "#2f9e57"],
        ["มนุษย์ภูมิ", gy0 + 6 * chH, "#d9a406"],
        ["นรกภูมิ", gy0 + 10 * chH, "#e23b3b"],
      ] as const).map(([txt, yc, col]) => (
        <text key={txt} x={20} y={yc} fill={col} fontSize={12} textAnchor="middle" transform={`rotate(-90 20 ${yc})`}>{txt}</text>
      ))}
      {/* ไฮไลต์ช่องปีที่โฟกัส (centerAge=ฟ้า) + ปีที่ทำนาย (อายุ+1=ส้ม) + เส้นแบ่งคอลัมน์ */}
      {ages.map((a, i) => (
        <g key={"v" + i}>
          {a === centerAge && <rect x={gx0 + i * cw} y={gy0} width={cw} height={gy1 - gy0} fill="#dbe7fb" />}
          {a === curAge + 1 && <rect x={gx0 + i * cw} y={gy0} width={cw} height={gy1 - gy0} fill="#fdf1d8" />}
          <line x1={gx0 + i * cw} y1={gy0} x2={gx0 + i * cw} y2={gy1} stroke="#eef2f9" />
        </g>
      ))}
      <line x1={gx1} y1={gy0} x2={gx1} y2={gy1} stroke="#eef2f9" />
      {/* เส้นแบ่งช่องค่า (13 เส้น = 12 ช่อง) + ตัวเลข/ชื่อภพ กลางช่อง */}
      {Array.from({ length: 13 }, (_, k) => (
        <line key={"h" + k} x1={gx0} y1={gy0 + k * chH} x2={gx1} y2={gy0 + k * chH}
          stroke={k === 0 || k === 4 || k === 8 || k === 12 ? "#cdd6e6" : "#eef2f9"} />
      ))}
      {Array.from({ length: 12 }, (_, row) => {
        const v = 12 - row; // row 0 = ค่า 12 (บนสุด)
        const yc = gy0 + (row + 0.5) * chH; // กลางช่อง
        const h = natal[row];
        return (
          <g key={v}>
            <text x={gx0 - 8} y={yc + 4} fill="#7a88a8" fontSize={11} textAnchor="end">{v}</text>
            {h && <text x={gx1 + 8} y={yc + 4} fill="#2f9e57" fontSize={11}>{h.name}</text>}
          </g>
        );
      })}
      {/* เส้นกราฟโค้ง */}
      <path d={path} fill="none" stroke="#2f9e57" strokeWidth={3} />
      {/* จุด + % + พ.ศ. + อายุ */}
      {ages.map((age, i) => {
        const v = valOf(age), isCur = age === curAge + 1, isCenter = age === centerAge, px = x(i), py = y(v);
        const below = v >= 7;
        const labelY = below ? py + 14 : py - 22;
        return (
          <g key={i}>
            <text x={px} y={py + (below ? -8 : 12)} fill="#6b7794" fontSize={9} textAnchor="middle">{Math.floor((v / 12) * 100)}%</text>
            {isCenter && !isCur && <circle cx={px} cy={py} r={8} fill="none" stroke="#2f6fb0" strokeWidth={2} />}
            {isCur && <circle cx={px} cy={py} r={8} fill="#e0a31f" opacity={0.45} />}
            <circle cx={px} cy={py} r={4} fill={isCur ? "#e0a31f" : isCenter ? "#2f6fb0" : "#e23b3b"} stroke="#ffffff" strokeWidth={1.5} />
            <text x={px} y={labelY} fill={isCur ? "#b07d12" : "#2f6fb0"} fontSize={10} fontWeight={isCur || isCenter ? 700 : 400} textAnchor="middle">{birthYear + age + 543}</text>
            <text x={px} y={labelY + 11} fill="#8a95ad" fontSize={9} textAnchor="middle">อายุ {age} ปี</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- 3. ตารางปี (คลิกช่อง → ยึดปีนั้นเป็นศูนย์กลางกราฟ) ---------- */
function YearTable({ data, centerAge, setCenterAge, curAge, light }: { data: ApiResponse; centerAge: number; setCenterAge: (a: number) => void; curAge: number; light?: boolean }) {
  const birthYear = Number(data.birth.solarDate.slice(0, 4));
  const birthMon = Number(data.birth.solarDate.slice(5, 7));
  // คอลัมน์เดือนเริ่มที่ "เดือนเกิด" แล้ววน 12 เดือน (ตรงคอลัมน์กับปีนักษัตรที่เริ่มปีเกิด)
  const months = Array.from({ length: 12 }, (_, k) => THAI_MONTHS[(birthMon - 1 + k) % 12]);
  const zodiacs = Array.from({ length: 12 }, (_, c) => ZODIAC[(((birthYear + c) % 12) + 12) % 12]);
  const bd = light ? "#d5dcea" : "#2c3658";
  const td: React.CSSProperties = { ...baseCell, width: COL, fontSize: 11, paddingTop: 1, paddingBottom: 1, borderLeftColor: bd, borderTopColor: bd, background: light ? "#ffffff" : undefined };
  const lbl: React.CSSProperties = { ...td, width: LBL, textAlign: "right", paddingRight: 6, color: light ? "#5a6b8a" : "#9fb0d8", background: light ? "#eef2f9" : "#161d35" };
  const tbl: React.CSSProperties = { ...tableStyle(GRID_W + RGT), borderRightColor: bd, borderBottomColor: bd };
  const maxAge = 96;
  const rowCount = Math.ceil(maxAge / 12);
  return (
    <table style={tbl}>
      <tbody>
        <tr><td style={lbl}>เดือน</td>{months.map((m, i) => <td key={i} style={{ ...td, color: light ? "#5a6b8a" : "#9fb0d8" }}>{m}</td>)}
          <td rowSpan={2 + rowCount} style={{ ...td, width: RGT, background: light ? "#eef2f9" : "#161d35" }} /></tr>
        <tr><td style={lbl}>ปีนักษัตร</td>{zodiacs.map((z, i) => <td key={i} style={{ ...td, color: light ? "#b07d12" : "#c8a96b", fontSize: 10 }}>{z}</td>)}</tr>
        {Array.from({ length: rowCount }, (_, r) => (
          <tr key={r}>
            <td style={lbl}>{r === 0 ? "พ.ศ. / อายุ" : ""}</td>
            {Array.from({ length: 12 }, (_, c) => {
              const age = r * 12 + c + 1;
              const isCur = age === curAge + 1; // ปีที่ทำนาย = อายุ+1
              const inWin = r === Math.floor((centerAge - 1) / 12); // แถวเดียวกับรอบที่กราฟแสดง
              const isCenter = age === centerAge;
              const bg = light
                ? (isCur ? "#fdf1d8" : isCenter ? "#dbe7fb" : inWin ? "#f2f5fb" : "#ffffff")
                : (isCur ? "#4a3a1a" : isCenter ? "#2a3358" : inWin ? "#1b2342" : undefined);
              return (
                <td key={c} onClick={() => setCenterAge(age)} style={{ ...td, cursor: "pointer", background: bg }}>
                  <div style={{ color: isCur ? (light ? "#b07d12" : "#ffd23f") : (light ? "#2b5cab" : "#2f6fb0"), fontWeight: isCur || isCenter ? 700 : 400 }}>{birthYear + age + 543}</div>
                  <div style={{ color: light ? "#8a95ad" : "#7b88ad", fontSize: 10 }}>{age}</div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- 4. คำทำนายพื้นดวง 12 ภพ ---------- */
function NatalReadings({ natal }: { natal: Natal[] }) {
  const realmColor = (r: string) => (r === "สวรรค์ภูมิ" ? "#37d67a" : r === "มนุษย์ภูมิ" ? "#ffd23f" : "#ff6b6b");
  return (
    <section style={{ marginTop: 20 }}>
      <h3>คำทำนายพื้นดวง 12 ภพ</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {natal.map((n) => (
          <div key={n.no} style={{ border: "1px solid #e4e9f2", borderRadius: 8, padding: 10, background: "#ffffff", boxShadow: "0 1px 3px rgba(30,41,77,0.06)" }}>
            <div style={{ fontWeight: 700 }}>{n.name} — เลข {n.value} <span style={{ color: realmColor(n.realm), fontSize: 12 }}>({n.realm})</span></div>
            <div style={{ fontSize: 11, opacity: 0.6, margin: "4px 0" }}>{n.meaning}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{n.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e8", background: "#ffffff", color: "#26324d" };
const btnStyle: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "none", background: "#2f6fe0", color: "#ffffff", fontWeight: 600, cursor: "pointer" };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
const capStyle: React.CSSProperties = { fontSize: 11, color: "#5a6b8a" };
const selectStyle: React.CSSProperties = { padding: "8px 8px", borderRadius: 8, border: "1px solid #cbd5e8", background: "#ffffff", color: "#26324d" };
const cardStyle: React.CSSProperties = { border: "1px solid #e4e9f2", borderRadius: 10, padding: 12, background: "#ffffff", marginTop: 8, boxShadow: "0 1px 3px rgba(30,41,77,0.06)" };

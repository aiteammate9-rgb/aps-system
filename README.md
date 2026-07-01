# Life Graph — ระบบดูดวงกราฟชีวิต (เลข 12 ตัว)

Monorepo สำหรับระบบทำนาย "กราฟชีวิต" ตามพยากรณ์ศาสตร์เลข 12 ตัว

## โครงสร้าง

```
apps/
  web/   — Next.js frontend (ฟอร์ม + กราฟ SVG)
  api/   — Fastify REST API  (POST /v1/life-graph)
packages/
  types/             — TypeScript types ใช้ร่วมกัน
  life-graph-engine/ — 👈 เครื่องคำนวณเลข 12 ตัว (เสียบสูตรจริงที่นี่)
  calendar/          — แปลงจันทรคติ ⇄ สุริยคติ (placeholder, P1)
  interpretation/    — score → คำทำนาย
```

## สถานะ: P0 (scaffold)

- ✅ Monorepo (pnpm + turbo) + TypeScript strict
- ✅ Engine interface + unit tests (สูตรเป็น **placeholder** — deterministic)
- ✅ API `/v1/life-graph` + tests (inject)
- ✅ Web หน้าฟอร์ม + กราฟพื้นฐาน
- ⏳ P1: ปฏิทินจันทรคติจริง, รับ input แบบ lunar
- ⏳ P2: บันทึก/แชร์ + OG image
- ⏳ P3: public API (key, rate limit, cache)

## เริ่มใช้งาน

```bash
pnpm install
pnpm test          # รัน unit test ทุก package
pnpm typecheck     # ตรวจ type ทั้ง repo

# dev
pnpm --filter @life-graph/api dev    # API ที่ :3001
pnpm --filter @life-graph/web dev    # Web ที่ :3000
```

## เสียบสูตรจริง

แก้เฉพาะ 2 ฟังก์ชันใน [`packages/life-graph-engine/src/index.ts`](packages/life-graph-engine/src/index.ts):

1. `deriveBase12(input)` — วันเกิด → เลขฐาน 12 ตัว
2. `scoreYear(base12, age)` — ฐาน 12 ตัว + อายุ → คะแนนปีนั้น

ส่วน loop รายปีและการหา peak/trough ใช้ได้เลยไม่ต้องแก้

## ⚠️ Disclaimer

ผลทำนายเป็นความเชื่อเพื่อความบันเทิง ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย

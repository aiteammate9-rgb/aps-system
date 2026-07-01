import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { BirthInput, DateRange } from "@life-graph/types";
import { computeLifeGraph } from "@life-graph/engine";
import { weekdayOf, thaiLunarMonth, thaiCalendarInfo } from "@life-graph/calendar";
import {
  interpretSeries,
  interpretNatal,
  findRepeatedGroups,
  interpretWeekday,
  interpretBirthMonth,
  interpretYearlyTransits,
  computeDivination,
  interpretRasi,
  interpretCompatibility,
  type Person,
  DISCLAIMER,
} from "@life-graph/interpretation";

interface LifeGraphBody {
  name?: string;
  birth: {
    date: string; // "YYYY-MM-DD"
    time?: string; // "HH:mm"
    calendar?: "solar" | "lunar";
    timezone?: string;
  };
  range?: { fromYear: number; toYear: number };
  viewDate?: string; // วันจร "YYYY-MM-DD" (สำหรับดวงจรประจำปี)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // เปิด CORS ให้ frontend (dev: localhost) เรียกได้
  app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: LifeGraphBody }>("/v1/life-graph", async (req, reply) => {
    const body = req.body;

    if (!body?.birth?.date || !ISO_DATE.test(body.birth.date)) {
      return reply
        .code(400)
        .send({ error: "birth.date is required as YYYY-MM-DD" });
    }

    // P1: ถ้า calendar === "lunar" ให้แปลงผ่าน @life-graph/calendar ก่อน
    if (body.birth.calendar === "lunar") {
      return reply
        .code(501)
        .send({ error: "lunar input not supported yet (planned for P1)" });
    }

    const birth: BirthInput = {
      solarDate: body.birth.date,
      birthTime: body.birth.time ?? "12:00",
      timezone: body.birth.timezone ?? "Asia/Bangkok",
    };

    const birthYear = Number(body.birth.date.slice(0, 4));
    const range: DateRange = body.range ?? {
      fromYear: birthYear,
      toYear: birthYear + 90,
    };

    try {
      const result = computeLifeGraph(birth, range);
      const interpretation = interpretSeries(result.points);
      const natal = interpretNatal(result.base12);
      const repeatedGroups = findRepeatedGroups(natal);
      const [by, bm, bd] = body.birth.date.split("-").map(Number);
      const weekday = interpretWeekday(weekdayOf(by!, bm!, bd!));
      const birthMonth = interpretBirthMonth(thaiLunarMonth(by!, bm!, bd!));
      const birthInfo = thaiCalendarInfo(by!, bm!, bd!);
      // วันจร = "วันเกิด (วัน/เดือน) ในปีที่ดู" — ยึดวัน/เดือนเกิดเสมอ ใช้แค่ปีจากวันจร
      const today = new Date();
      const viewYear = body.viewDate && ISO_DATE.test(body.viewDate)
        ? Number(body.viewDate.slice(0, 4))
        : today.getUTCFullYear();
      const viewDate = `${viewYear}-${String(bm).padStart(2, "0")}-${String(bd).padStart(2, "0")}`;
      const transitInfo = thaiCalendarInfo(viewYear, bm!, bd!);
      // ดวงจรประจำปี = ปีที่ทำนาย (วันจร + 1 ปี)
      const yearlyTransits = interpretYearlyTransits(result.base12, natal, viewYear - by! + 1);
      // 4 ศาสตร์เสริม จากวัน/เดือน/ปีเกิด + นักษัตรปีที่ดู
      const divination = computeDivination({
        weekday: birthInfo.weekday, month: bm!, day: bd!, beYear: birthInfo.be,
        birthNaksatr: birthInfo.naksatr, viewNaksatr: transitInfo.naksatr,
      });
      return reply.send({
        name: body.name,
        birth,
        range,
        result,
        natal,
        repeatedGroups,
        weekday,
        birthMonth,
        birthInfo,
        viewDate,
        transitInfo,
        yearlyTransits,
        divination,
        interpretation,
        disclaimer: DISCLAIMER,
      });
    } catch (err) {
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "compute failed" });
    }
  });

  // คู่สมพงษ์ — เทียบ 2 วันเกิด
  app.post<{ Body: { a?: string; b?: string } }>("/v1/compatibility", async (req, reply) => {
    const { a, b } = req.body ?? {};
    if (!a || !b || !ISO_DATE.test(a) || !ISO_DATE.test(b)) {
      return reply.code(400).send({ error: "a and b are required as YYYY-MM-DD" });
    }
    try {
      const toPerson = (iso: string): Person => {
        const [y, m, d] = iso.split("-").map(Number);
        const info = thaiCalendarInfo(y!, m!, d!);
        const rasi = interpretRasi(m!, d!);
        return { weekday: info.weekday, naksatr: info.naksatr, naksatrName: info.naksatrName, rasiElement: rasi.element };
      };
      const pa = toPerson(a), pb = toPerson(b);
      return reply.send({ a: pa, b: pb, compatibility: interpretCompatibility(pa, pb) });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "compute failed" });
    }
  });

  return app;
}

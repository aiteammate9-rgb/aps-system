import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("POST /v1/life-graph", () => {
  it("computes a graph for a valid solar birth date", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/life-graph",
      payload: {
        name: "ทดสอบ",
        birth: { date: "1995-08-15", timezone: "Asia/Bangkok" },
        range: { fromYear: 1995, toYear: 2005 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.points).toHaveLength(11);
    expect(body.interpretation).toHaveLength(11);
    expect(typeof body.disclaimer).toBe("string");
  });

  it("rejects a missing date", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/life-graph",
      payload: { birth: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 501 for lunar input (P1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/life-graph",
      payload: { birth: { date: "1995-08-15", calendar: "lunar" } },
    });
    expect(res.statusCode).toBe(501);
  });
});

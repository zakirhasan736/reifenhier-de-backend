import assert from "node:assert/strict";
import { test } from "node:test";
const { nextPriceTrend, berlinDay } = await import("../src/api/utils/priceHistory.js");

test("first point, then only real changes add points", () => {
  let t = nextPriceTrend(null, 89.9, "2026-10-01");
  assert.deepEqual(t.points, [["2026-10-01", 89.9]]);
  t = nextPriceTrend(t, 89.9, "2026-10-02"); // unchanged → no new point
  assert.equal(t.points.length, 1);
  t = nextPriceTrend(t, 84.5, "2026-10-05");
  t = nextPriceTrend(t, 82.0, "2026-10-05"); // same day → replaced
  assert.deepEqual(t.points, [["2026-10-01", 89.9], ["2026-10-05", 82]]);
});

test("trims to 90 days but keeps the starting value before the window", () => {
  let t = { points: [["2026-01-01", 100], ["2026-03-01", 95], ["2026-06-01", 90], ["2026-09-15", 88]] };
  t = nextPriceTrend(t, 80, "2026-10-27"); // window starts 2026-07-29
  assert.deepEqual(t.points.map(p => p[0]), ["2026-06-01", "2026-09-15", "2026-10-27"]);
});

test("ignores missing prices", () => {
  const t = nextPriceTrend({ points: [["2026-10-01", 50]] }, 0, "2026-10-02");
  assert.equal(t.points.length, 1);
});

test("berlinDay is YYYY-MM-DD in Berlin time", () => {
  assert.equal(berlinDay(new Date("2026-10-27T23:30:00Z")), "2026-10-28"); // 00:30 CET
});

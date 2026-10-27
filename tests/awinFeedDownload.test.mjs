import assert from "node:assert/strict";
import { test } from "node:test";
const { parseFeedUrl, buildFeedUrl, parseFeedList } = await import("../src/api/utils/awinFeedDownload.js");

const url = "https://productdata.awin.com/datafeed/download/apikey/abc123/language/de/cid/566/fid/111,222/columns/aw_deep_link,merchant_name/format/csv/delimiter/%2C/compression/zip/adultcontent/1/";

test("per-shop URL keeps every setting and only changes fid", () => {
  const p = parseFeedUrl(url);
  assert.equal(p.params.get("apikey"), "abc123");
  assert.equal(p.params.get("cid"), "566");
  assert.equal(p.params.get("fid"), "111,222");
  assert.equal(buildFeedUrl(p, { fid: "222" }), url.replace("/fid/111,222/", "/fid/222/"));
});

test("fid is added when the URL has none", () => {
  const p = parseFeedUrl(url.replace("/fid/111,222", ""));
  assert.match(buildFeedUrl(p, { fid: "9" }), /\/fid\/9\//);
  assert.match(buildFeedUrl(p, { fid: "9" }), /\/cid\/566\//);
});

test("feed list CSV with quoted names", () => {
  const rows = parseFeedList('Advertiser ID,Advertiser Name,Membership Status,Feed ID,Last Imported\n1,"reifen.com, DE",active,111,2026-10-27 06:00:00\n');
  assert.equal(rows[0]["Advertiser Name"], "reifen.com, DE");
  assert.equal(rows[0]["Feed ID"], "111");
});

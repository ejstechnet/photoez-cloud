import { test } from "node:test";
import assert from "node:assert/strict";
import { citySlug, cityFromSlug, findPlace, lookupZip, milesBetween, parseZipTable } from "./zips.ts";

const table = parseZipTable(
  [
    "# header",
    "98101\tSeattle\tWA\t47.6110\t-122.3360",
    "98103\tSeattle\tWA\t47.6710\t-122.3420",
    "97201\tPortland\tOR\t45.5078\t-122.6900",
    "04101\tPortland\tME\t43.6620\t-70.2590",
    "63101\tSaint Louis\tMO\t38.6345\t-90.1910",
    "96960\tMajuro\tMH\t7.1000\t171.3800",
  ].join("\n"),
);

test("a ZIP finds its city", () => {
  assert.equal(lookupZip("98101", table)?.city, "Seattle");
  assert.equal(findPlace("98101-1234", table)?.zip, "98101");
  assert.equal(findPlace("99999", table), null);
});

test("a city with a state code or name finds the city center", () => {
  const seattle = findPlace("Seattle, WA", table);
  assert.equal(seattle?.state, "WA");
  assert.ok(Math.abs(seattle!.lat - 47.641) < 0.001);
  assert.equal(findPlace("portland maine", table)?.state, "ME");
  assert.equal(findPlace("Portland, OR", table)?.state, "OR");
});

test("a city without a state picks the one with the most ZIP codes", () => {
  assert.equal(findPlace("seattle", table)?.state, "WA");
  assert.equal(findPlace("Nowhere", table), null);
});

test("places outside the 50 states and DC are left out", () => {
  assert.equal(lookupZip("96960", table), null);
});

test("city addresses round-trip", () => {
  assert.equal(citySlug("Saint Louis"), "saint-louis");
  assert.equal(cityFromSlug("mo", "saint-louis", table)?.city, "Saint Louis");
  assert.equal(findPlace("St. Louis, MO", table)?.city, "Saint Louis");
});

test("distance in miles", () => {
  const seattle = lookupZip("98101", table)!;
  const portland = lookupZip("97201", table)!;
  const miles = milesBetween(seattle, portland);
  assert.ok(miles > 140 && miles < 150, String(miles));
});

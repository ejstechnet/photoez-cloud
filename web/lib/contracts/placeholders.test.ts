// Tests for contract placeholders.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { fillPlaceholders, type PlaceholderValues } from "./placeholders.ts";

const values: PlaceholderValues = {
  CLIENT_NAME: "Ashley Reed",
  CLIENT_EMAIL: "ashley@example.com",
  CLIENT_PHONE: "503-555-0100",
  SESSION_NAME: "Maternity",
  BOOKING_DATE: "Tuesday, October 6, 2026",
  BOOKING_TIME: "10:15 AM",
  PHOTOGRAPHER_NAME: "Elle Jones",
  STUDIO_NAME: "Elle Jones Studios",
  STUDIO_EMAIL: "studio@example.com",
  TOTAL_AMOUNT: "$250",
  DEPOSIT_AMOUNT: "$125",
  BALANCE_DUE: "$125",
  TODAY_DATE: "September 25, 2026",
};

test("fills every tag, spaces inside the braces allowed", () => {
  assert.equal(
    fillPlaceholders("<p>{{CLIENT_NAME}} booked {{ SESSION_NAME }} for {{TOTAL_AMOUNT}}.</p>", values),
    "<p>Ashley Reed booked Maternity for $250.</p>",
  );
});

test("a client's name can't add markup", () => {
  const html = fillPlaceholders("<p>{{CLIENT_NAME}}</p>", { ...values, CLIENT_NAME: '<script>x</script> & "Co"' });
  assert.equal(html, "<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;Co&quot;</p>");
});

test("unknown tags stay visible so typos get noticed", () => {
  assert.equal(fillPlaceholders("<p>{{CLIENT_NAM}}</p>", values), "<p>{{CLIENT_NAM}}</p>");
});

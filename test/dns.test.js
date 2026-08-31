import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "../lib/dns.js";

describe("dns_doctor", () => {
  it("formats", () => {
    assert.match(format({ ok: true }), /ok/i);
  });
});

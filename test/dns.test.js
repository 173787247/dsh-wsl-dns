import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  annotateResults,
  buildDnsAdvice,
  format,
  ipsEqual,
  readResolvNameserver,
} from "../lib/dns.js";

describe("ipsEqual / annotateResults", () => {
  it("detects mismatch ignoring order", () => {
    assert.equal(ipsEqual(["1.1.1.1", "8.8.8.8"], ["8.8.8.8", "1.1.1.1"]), true);
    assert.equal(ipsEqual(["1.1.1.1"], ["8.8.8.8"]), false);
  });

  it("flags mismatch when both sides non-empty and differ", () => {
    const [r] = annotateResults([
      { host: "api.deepseek.com", wsl: ["1.1.1.1"], windows: ["8.8.8.8"] },
    ]);
    assert.equal(r.mismatch, true);
  });
});

describe("buildDnsAdvice", () => {
  it("mentions mismatch and net_doctor", () => {
    const tips = buildDnsAdvice({
      resolvNameserver: "172.20.1.1",
      results: annotateResults([
        { host: "api.deepseek.com", wsl: ["1.1.1.1"], windows: ["8.8.8.8"] },
      ]),
    });
    assert.ok(tips.some((t) => /differ/i.test(t)));
    assert.ok(tips.some((t) => /net_doctor/i.test(t)));
  });

  it("mentions WSL resolve failure", () => {
    const tips = buildDnsAdvice({
      results: annotateResults([{ host: "x.com", wsl: [], windows: ["1.1.1.1"] }]),
    });
    assert.ok(tips.some((t) => /failed to resolve/i.test(t)));
  });
});

describe("readResolvNameserver", () => {
  it("parses nameserver line", () => {
    assert.equal(
      readResolvNameserver({ readFile: () => "nameserver 172.20.64.1\n" }),
      "172.20.64.1",
    );
  });
});

describe("format", () => {
  it("includes MISMATCH", () => {
    assert.match(
      format({
        ok: true,
        results: [{ host: "h", wsl: ["1"], windows: ["2"], mismatch: true }],
        advice: [],
      }),
      /MISMATCH/,
    );
  });
});

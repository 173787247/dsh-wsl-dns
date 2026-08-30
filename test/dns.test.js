import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDnsAdvice,
  formatDnsReport,
  parseResolvConf,
  parseWindowsDnsOutput,
} from "../lib/dns.js";

describe("dns_doctor", () => {
  it("parses resolv.conf", () => {
    const r = parseResolvConf("nameserver 1.1.1.1\nnameserver 8.8.8.8\noptions edns0\n");
    assert.deepEqual(r.nameservers, ["1.1.1.1", "8.8.8.8"]);
  });

  it("parses Windows DNS lines", () => {
    const w = parseWindowsDnsOutput("Ethernet=1.1.1.1,1.0.0.1\n");
    assert.equal(w[0].interface, "Ethernet");
    assert.deepEqual(w[0].servers, ["1.1.1.1", "1.0.0.1"]);
  });

  it("advises VPN when lookup fails", () => {
    const advice = buildDnsAdvice({
      resolv: { nameservers: ["172.28.0.1"] },
      windowsDns: [],
      lookups: [{ host: "api.github.com", ok: false, error: "ENOTFOUND" }],
    });
    assert.ok(advice.some((t) => /VPN/i.test(t)));
    assert.ok(advice.some((t) => /generateResolvConf/i.test(t)));
  });

  it("formats", () => {
    assert.match(
      formatDnsReport({
        resolv: { nameservers: ["1.1.1.1"] },
        lookups: [{ host: "api.github.com", ok: true, addresses: ["1.2.3.4"] }],
        advice: ["x"],
      }),
      /api\.github\.com -> 1\.2\.3\.4/,
    );
  });
});

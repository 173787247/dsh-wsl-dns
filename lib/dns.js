import { readFileSync } from "node:fs";
import dns from "node:dns/promises";

export function parseResolvConf(text) {
  const nameservers = [];
  const options = [];
  let generateResolvConf = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      if (/generateResolvConf\s*=\s*false/i.test(t)) generateResolvConf = false;
      if (/generateResolvConf\s*=\s*true/i.test(t)) generateResolvConf = true;
      continue;
    }
    const ns = t.match(/^nameserver\s+(\S+)/i);
    if (ns) {
      nameservers.push(ns[1]);
      continue;
    }
    const opt = t.match(/^options\s+(.+)/i);
    if (opt) options.push(opt[1]);
  }
  return { nameservers, options, generateResolvConf };
}

export function readResolvConf({ readFile = readFileSync } = {}) {
  try {
    return parseResolvConf(readFile("/etc/resolv.conf", "utf8"));
  } catch (err) {
    return {
      nameservers: [],
      options: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function windowsDnsScript() {
  return [
    "Get-DnsClientServerAddress -AddressFamily IPv4",
    "| Where-Object { $_.ServerAddresses -and $_.ServerAddresses.Count -gt 0 }",
    "| ForEach-Object { $_.InterfaceAlias + '=' + ($_.ServerAddresses -join ',') }",
    "| Out-String -Width 200",
  ].join(" ");
}

export function parseWindowsDnsOutput(stdout) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const i = line.indexOf("=");
    if (i < 0) return { raw: line };
    return {
      interface: line.slice(0, i),
      servers: line.slice(i + 1).split(",").map((s) => s.trim()).filter(Boolean),
    };
  });
}

export async function lookupHosts(hosts, { lookupFn = dns.lookup } = {}) {
  const out = [];
  for (const host of hosts) {
    try {
      const r = await lookupFn(host, { all: true });
      const addrs = Array.isArray(r) ? r.map((x) => x.address) : [r.address];
      out.push({ host, ok: true, addresses: addrs });
    } catch (err) {
      out.push({
        host,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

export function buildDnsAdvice({ resolv, windowsDns, lookups }) {
  const tips = [];
  if (resolv?.nameservers?.length) {
    tips.push(`WSL nameservers: ${resolv.nameservers.join(", ")}`);
  } else {
    tips.push("WSL /etc/resolv.conf has no nameserver entries.");
  }
  if (windowsDns?.length) {
    tips.push("Windows DNS (best-effort): " + windowsDns.map((w) =>
      w.servers ? `${w.interface}=[${w.servers.join(", ")}]` : w.raw,
    ).join("; "));
  } else {
    tips.push("Could not read Windows DNS (PowerShell Get-DnsClientServerAddress).");
  }
  const failed = (lookups || []).filter((l) => !l.ok);
  if (failed.length) {
    tips.push(`Lookup failed: ${failed.map((f) => f.host).join(", ")}. Check VPN / corporate DNS / split tunnel.`);
    tips.push("If using VPN, try disconnecting or using Windows DNS servers inside WSL.");
    tips.push("For static resolv.conf set generateResolvConf=false under [network] in /etc/wsl.conf, then restart WSL.");
  } else {
    tips.push("Lookups succeeded for configured hosts.");
  }
  return tips;
}

export function formatDnsReport(report) {
  const lines = ["dns_doctor"];
  if (report.error) lines.push(`error: ${report.error}`);
  if (report.resolv?.nameservers) {
    lines.push(`resolv: ${report.resolv.nameservers.join(", ")}`);
  }
  for (const l of report.lookups || []) {
    lines.push(l.ok
      ? `${l.host} -> ${(l.addresses || []).join(", ")}`
      : `${l.host} FAIL: ${l.error}`);
  }
  for (const tip of report.advice || []) lines.push(`- ${tip}`);
  return lines.join("\n");
}

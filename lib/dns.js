import { promises as dns } from "node:dns";
import { readFileSync } from "node:fs";
import { runPowerShell } from "./wsl-host.js";

export function notWsl() {
  return { ok: false, error: "not running in WSL", results: [], advice: [] };
}

export function parameters() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      hosts: {
        type: "array",
        items: { type: "string" },
        description: "Hostnames to resolve (default api.github.com, registry.npmjs.org, api.deepseek.com).",
      },
    },
  };
}

export function outputSchema() {
  return { type: "object", additionalProperties: true };
}

export function format(v) {
  const lines = [`dns_doctor ok=${v.ok}`];
  if (v.resolvNameserver) lines.push(`resolv.conf nameserver: ${v.resolvNameserver}`);
  if (v.mismatchCount != null) lines.push(`mismatchHosts: ${v.mismatchCount}`);
  for (const r of v.results || []) {
    const flag = r.mismatch ? " MISMATCH" : "";
    lines.push(
      `${r.host}: wsl=[${(r.wsl || []).join(",")}] win=[${(r.windows || []).join(",")}]${flag}`,
    );
  }
  for (const a of v.advice || []) lines.push(`- ${a}`);
  return lines.join("\n");
}

export function readResolvNameserver({ readFile = readFileSync } = {}) {
  try {
    const m = readFile("/etc/resolv.conf", "utf8").match(/^nameserver\s+(\S+)/m);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

/** Compare sorted unique IPv4 lists. */
export function ipsEqual(a = [], b = []) {
  const sa = [...new Set(a)].sort().join(",");
  const sb = [...new Set(b)].sort().join(",");
  return sa === sb;
}

export function annotateResults(results = []) {
  return results.map((r) => {
    const wsl = r.wsl || [];
    const windows = r.windows || [];
    const wslEmpty = wsl.length === 0;
    const winEmpty = windows.length === 0;
    const mismatch = !wslEmpty && !winEmpty && !ipsEqual(wsl, windows);
    return {
      host: r.host,
      wsl,
      windows,
      wslEmpty,
      winEmpty,
      mismatch,
    };
  });
}

export function buildDnsAdvice({ resolvNameserver = "", results = [] } = {}) {
  const tips = [];
  const annotated = results[0]?.mismatch != null ? results : annotateResults(results);
  const failedWsl = annotated.filter((r) => r.wslEmpty);
  const mismatches = annotated.filter((r) => r.mismatch);
  const winOnlyFail = annotated.filter((r) => !r.wslEmpty && r.winEmpty);

  if (failedWsl.length) {
    tips.push(
      `WSL failed to resolve: ${failedWsl.map((r) => r.host).join(", ")}. Check VPN/DNS; try regenerating resolv.conf or networkingMode=mirrored (wslconfig_hint).`,
    );
  }
  if (mismatches.length) {
    tips.push(
      `WSL vs Windows A records differ for: ${mismatches.map((r) => r.host).join(", ")}. Often VPN split-DNS or hijacked resolv.conf — prefer mirrored networking or fix the Windows DNS the WSL nameserver points at.`,
    );
  }
  if (winOnlyFail.length) {
    tips.push(
      `Windows resolve failed while WSL succeeded for: ${winOnlyFail.map((r) => r.host).join(", ")}. Unusual; re-check PowerShell DNS / corporate filter.`,
    );
  }
  if (resolvNameserver) {
    tips.push(`resolv.conf nameserver=${resolvNameserver} (often the Windows host IP under NAT).`);
  }
  if (!failedWsl.length && !mismatches.length) {
    tips.push("WSL resolution looks OK for probed hosts.");
  }
  tips.push("If HTTPS still fails after DNS OK, run net_doctor (NODE_USE_ENV_PROXY / proxy port).");
  tips.push("TLS errors after laptop sleep may be clock skew — run clock_doctor.");
  return tips;
}

async function resolveWsl(host) {
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

async function resolveWin(host) {
  try {
    const { stdout } = await runPowerShell(
      `([System.Net.Dns]::GetHostAddresses('${host.replace(/'/g, "''")}') | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | ForEach-Object { $_.IPAddressToString }) -join ','`,
      { timeoutMs: 15_000 },
    );
    return String(stdout)
      .trim()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function execute(args, _config = {}, deps = {}) {
  const hosts =
    Array.isArray(args?.hosts) && args.hosts.length
      ? args.hosts.map(String)
      : ["api.github.com", "registry.npmjs.org", "api.deepseek.com"];
  const resolvNameserver = (deps.readResolvNameserver || readResolvNameserver)({
    readFile: deps.readFile || readFileSync,
  });
  const resolveWslFn = deps.resolveWsl || resolveWsl;
  const resolveWinFn = deps.resolveWin || resolveWin;
  const raw = [];
  for (const host of hosts) {
    raw.push({
      host,
      wsl: await resolveWslFn(host),
      windows: await resolveWinFn(host),
    });
  }
  const results = annotateResults(raw);
  const advice = buildDnsAdvice({ resolvNameserver, results });
  const failed = results.filter((r) => r.wslEmpty);
  return {
    ok: failed.length === 0,
    resolvNameserver,
    mismatchCount: results.filter((r) => r.mismatch).length,
    results,
    advice,
  };
}

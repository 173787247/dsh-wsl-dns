import { promises as dns } from "node:dns";
import { readFileSync } from "node:fs";
import { runPowerShell } from "./wsl-host.js";

export function notWsl() {
  return { ok: false, error: "not running in WSL" };
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
  for (const r of v.results || []) {
    lines.push(`${r.host}: wsl=[${(r.wsl || []).join(",")}] win=[${(r.windows || []).join(",")}]`);
  }
  for (const a of v.advice || []) lines.push(`- ${a}`);
  return lines.join("\n");
}

async function resolveWsl(host) {
  try {
    return await dns.resolve4(host);
  } catch (err) {
    return [];
  }
}

async function resolveWin(host) {
  try {
    const { stdout } = await runPowerShell(
      `([System.Net.Dns]::GetHostAddresses('${host.replace(/'/g, "''")}') | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | ForEach-Object { $_.IPAddressToString }) -join ','`,
      { timeoutMs: 15_000 },
    );
    return String(stdout).trim().split(",").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function execute(args) {
  const hosts = Array.isArray(args?.hosts) && args.hosts.length
    ? args.hosts.map(String)
    : ["api.github.com", "registry.npmjs.org", "api.deepseek.com"];
  let resolvNameserver = "";
  try {
    const m = readFileSync("/etc/resolv.conf", "utf8").match(/^nameserver\s+(\S+)/m);
    resolvNameserver = m ? m[1] : "";
  } catch {}
  const results = [];
  for (const host of hosts) {
    results.push({ host, wsl: await resolveWsl(host), windows: await resolveWin(host) });
  }
  const failed = results.filter((r) => r.wsl.length === 0);
  const advice = [];
  if (failed.length) {
    advice.push("WSL failed to resolve some hosts — check VPN/DNS; try regenerating resolv.conf or mirrored networking.");
  } else {
    advice.push("WSL resolution looks OK for probed hosts.");
  }
  return { ok: failed.length === 0, resolvNameserver, results, advice };
}

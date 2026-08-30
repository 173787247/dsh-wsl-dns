import { detectWsl, runPowerShell } from "./lib/wsl-host.js";
import {
  buildDnsAdvice,
  formatDnsReport,
  lookupHosts,
  parseWindowsDnsOutput,
  readResolvConf,
  windowsDnsScript,
} from "./lib/dns.js";

export const name = "dsh-wsl-dns";
export const inject = ["tools", "systemPrompt"];

const DEFAULT_HOSTS = ["api.github.com", "registry.npmjs.org"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 15_000);
  const hosts = Array.isArray(config.hosts) && config.hosts.length
    ? config.hosts.map(String)
    : DEFAULT_HOSTS;
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:dns_doctor",
    order: 124,
    text: [
      "Use dns_doctor when GitHub, npm, or other HTTPS hosts fail to resolve inside WSL.",
      "It compares /etc/resolv.conf with Windows DNS and resolves api.github.com / registry.npmjs.org (configurable).",
      "Advise VPN/corporate DNS or generateResolvConf changes — do not rewrite resolv.conf automatically.",
    ].join(" "),
  });

  ctx.tools.register({
    name: "dns_doctor",
    description:
      "Compare WSL resolv.conf vs Windows DNS; resolve key hosts and advise on VPN/corporate DNS.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        hosts: {
          type: "array",
          items: { type: "string" },
          description: "Hosts to resolve (default from config).",
        },
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          wsl: { type: "boolean" },
          resolv: { type: "object", additionalProperties: true },
          windowsDns: { type: "array", items: { type: "object", additionalProperties: true } },
          lookups: { type: "array", items: { type: "object", additionalProperties: true } },
          advice: { type: "array", items: { type: "string" } },
          error: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: formatDnsReport(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!wsl) {
        return { wsl: false, error: "not running in WSL", advice: [] };
      }
      const targetHosts = Array.isArray(args?.hosts) && args.hosts.length
        ? args.hosts.map(String)
        : hosts;
      const resolv = readResolvConf();
      let windowsDns = [];
      try {
        const { stdout } = await runPowerShell(windowsDnsScript(), { timeoutMs });
        windowsDns = parseWindowsDnsOutput(stdout);
      } catch {
        windowsDns = [];
      }
      const lookups = await lookupHosts(targetHosts);
      const report = { wsl: true, resolv, windowsDns, lookups };
      report.advice = buildDnsAdvice(report);
      return report;
    },
    presentCall: () => ({ card: "generic", title: "DNS doctor" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "DNS doctor failed", content: result.content }
        : { card: "generic", title: "DNS doctor", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

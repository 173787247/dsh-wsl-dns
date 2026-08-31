import { detectWsl } from "./lib/wsl-host.js";
import * as core from "./lib/dns.js";

export const name = "dsh-wsl-dns";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 15_000);
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:dns_doctor",
    order: 116,
    text: "Use dns_doctor for WSL/Windows interop: Compare WSL vs Windows DNS resolution for common endpoints.",
  });

  ctx.tools.register({
    name: "dns_doctor",
    description: "Compare WSL vs Windows DNS resolution for common endpoints.",
    parameters: core.parameters(config),
    output: {
      schema: core.outputSchema(),
      render: (_args, value) => [{ type: "text", text: core.format(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!wsl) return core.notWsl ? core.notWsl() : { ok: false, error: "not running in WSL" };
      return core.execute(args, config);
    },
    presentCall: () => ({ card: "generic", title: "dns_doctor" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "dns_doctor failed", content: result.content }
        : { card: "generic", title: "dns_doctor", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

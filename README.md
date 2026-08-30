# dsh-wsl-dns

DeepSeek Harness tool: **`dns_doctor`** — compare WSL resolv.conf vs Windows DNS and resolve key hosts.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

---

## Why

Corporate VPN and WSL `generateResolvConf` often leave Linux unable to resolve GitHub or npm while Windows works. This tool reads `/etc/resolv.conf`, best-effort Windows DNS, and resolves key hosts.

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-dns
```

Restart `dsh web`. New session → Tools should list `dns_doctor`.

## Config

```yaml
- id: dsh-wsl-dns
  name: dsh-wsl-dns
  config:
    timeoutMs: 15000
    hosts: [api.github.com, registry.npmjs.org]
```

| Key | Default | Meaning |
|-----|---------|---------|
| `timeoutMs` | `15000` | Tool timeout |
| `hosts` | `api.github.com`, `registry.npmjs.org` | Hosts to resolve |

## Test

```sh
npm test
```

## License

MIT

# dsh-wsl-dns

DeepSeek Harness 工具：**`dns_doctor`** — 对比 WSL resolv.conf 与 Windows DNS，并解析关键主机。

属于 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**。

[English → README.md](./README.md)

---

## 为什么需要

公司 VPN 与 WSL `generateResolvConf` 常导致 Linux 无法解析 GitHub / npm，而 Windows 正常。本工具读取 `/etc/resolv.conf`、尽力获取 Windows DNS，并解析关键主机名。

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-dns
```

重启 `dsh web`。新会话 → Tools 应出现 `dns_doctor`。

## 配置

```yaml
- id: dsh-wsl-dns
  name: dsh-wsl-dns
  config:
        timeoutMs: 15000
        hosts: [api.github.com, registry.npmjs.org]
```

| 键 | 默认 | 含义 |
|----|------|------|
| `timeoutMs` | `15000` | 工具超时 |
| `hosts` | `api.github.com`, `registry.npmjs.org` | 要解析的主机 |

## 测试

```sh
npm test
```

## 许可

MIT

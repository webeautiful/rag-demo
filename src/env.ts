import { existsSync, readFileSync } from 'node:fs';

/**
 * 极简 .env 加载器(零依赖)。
 * - 只读取,不覆盖已存在的 shell 环境变量(shell 优先)
 * - 忽略空行与 # 注释,值两侧引号会被剥掉
 */
export function loadDotEnv(path = '.env'): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t);
    if (!m) continue;
    const [, key, rawIn] = m;
    if (process.env[key] !== undefined) continue;
    let val = rawIn.trim();
    // 未加引号的值:剥掉行内注释(整值都是注释则置空)
    if (val.startsWith('#')) {
      val = '';
    } else if (val && !val.startsWith("'") && !val.startsWith('"')) {
      val = val.replace(/\s+#.*$/, '').trim();
    }
    process.env[key] = val.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadDotEnv();

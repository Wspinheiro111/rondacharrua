import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { backupDatabase, parseMysqlUrl, restoreDatabase } from "./mysqlBackupRestore";

const DRILL_CONFIRMATION = "CREATE_AND_DROP_DISPOSABLE_DATABASES";

function withDatabase(rawUrl: string, database: string) {
  const url = new URL(rawUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function main() {
  const adminRaw = process.env.DRILL_ADMIN_DATABASE_URL;
  if (!adminRaw) throw new Error("DRILL_ADMIN_DATABASE_URL é obrigatório para o restore drill.");
  if (process.env.DRILL_CONFIRM !== DRILL_CONFIRMATION) throw new Error(`Defina DRILL_CONFIRM=${DRILL_CONFIRMATION}.`);
  const parsed = parseMysqlUrl(adminRaw, "DRILL_ADMIN_DATABASE_URL");
  if (process.env.DRILL_ALLOW_HOST !== parsed.host) throw new Error(`Defina DRILL_ALLOW_HOST=${parsed.host} para confirmar o servidor descartável.`);

  const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
  const sourceDb = `w9_restore_drill_src_${suffix}`;
  const targetDb = `w9_restore_drill_dst_${suffix}`;
  const sourceUrl = withDatabase(adminRaw, sourceDb);
  const targetUrl = withDatabase(adminRaw, targetDb);
  const rootUrl = new URL(adminRaw);
  rootUrl.pathname = "/";
  const root = await mysql.createConnection(rootUrl.toString());
  const temp = await mkdtemp(resolve(tmpdir(), "w9-restore-drill-"));
  const dumpPath = resolve(temp, "drill.sql");

  try {
    await root.query(`CREATE DATABASE \`${sourceDb}\``);
    await root.query(`CREATE DATABASE \`${targetDb}\``);
    const source = await mysql.createConnection(sourceUrl);
    try {
      await source.query("CREATE TABLE restore_probe (id INT PRIMARY KEY, label VARCHAR(80) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
      await source.query("INSERT INTO restore_probe (id, label) VALUES (1, 'alpha'), (2, 'beta'), (3, 'gamma')");
    } finally {
      await source.end();
    }

    const backup = await backupDatabase({ databaseUrl: sourceUrl, outputPath: dumpPath });
    const restored = await restoreDatabase({
      sourceUrl,
      targetUrl,
      confirmation: "ERASE_RESTORE_TARGET",
      dumpPath,
    });

    const target = await mysql.createConnection(targetUrl);
    try {
      const [rows] = await target.query<RowDataPacket[]>("SELECT id, label FROM restore_probe ORDER BY id");
      if (rows.length !== 3 || rows[0]?.label !== "alpha" || rows[2]?.label !== "gamma") throw new Error("Restore drill falhou: dados restaurados divergem da origem.");
      const [tables] = await target.query<RowDataPacket[]>("SHOW TABLES LIKE 'restore_probe'");
      if (tables.length !== 1) throw new Error("Restore drill falhou: estrutura esperada não foi recriada.");
    } finally {
      await target.end();
    }

    console.log(JSON.stringify({
      ok: true,
      source: `${parsed.host}:${parsed.port}/${sourceDb}`,
      target: restored.target,
      sha256: backup.manifest.sha256,
      bytes: backup.manifest.bytes,
      rowsVerified: 3,
    }));
  } finally {
    await root.query(`DROP DATABASE IF EXISTS \`${targetDb}\``).catch(() => undefined);
    await root.query(`DROP DATABASE IF EXISTS \`${sourceDb}\``).catch(() => undefined);
    await root.end();
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Falha desconhecida no restore drill.");
  process.exitCode = 1;
});

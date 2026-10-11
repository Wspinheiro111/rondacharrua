import { describe, expect, it } from "vitest";
import {
  assertRestoreSafety,
  buildClientConfig,
  buildDumpArgs,
  buildRestoreArgs,
  computeSha256,
  parseMysqlUrl,
  verifyManifest,
} from "../scripts/mysqlBackupRestore";

describe("backup e restauração MySQL", () => {
  it("falha fechado para URL ausente ou protocolo não MySQL", () => {
    expect(() => parseMysqlUrl("", "DATABASE_URL")).toThrow(/DATABASE_URL/);
    expect(() => parseMysqlUrl("postgres://u:p@db.example/app", "DATABASE_URL")).toThrow(/mysql/i);
  });

  it("mantém a senha somente no arquivo temporário e fora de argumentos/labels", () => {
    const parsed = parseMysqlUrl("mysql://user:segredo@db.example:3307/w9_prod", "DATABASE_URL");
    const config = buildClientConfig(parsed);
    expect(config).toContain('password="segredo"');
    expect(config).toContain('host="db.example"');
    expect(buildDumpArgs("/tmp/client.cnf", parsed.database).join(" ")).not.toContain("segredo");
    expect(buildRestoreArgs("/tmp/client.cnf", parsed.database).join(" ")).not.toContain("segredo");
    expect(parsed.safeLabel).toBe("db.example:3307/w9_prod");
    expect(parsed.safeLabel).not.toContain("segredo");
  });

  it("recusa restaurar sobre a mesma origem", () => {
    expect(() => assertRestoreSafety({
      sourceUrl: "mysql://u:p@db.example/w9_prod",
      targetUrl: "mysql://u:p2@db.example/w9_prod",
      confirmation: "ERASE_RESTORE_TARGET",
    })).toThrow(/origem/i);
  });

  it("exige confirmação destrutiva explícita", () => {
    expect(() => assertRestoreSafety({
      sourceUrl: "mysql://u:p@db.example/w9_prod",
      targetUrl: "mysql://u:p@db.example/w9_restore_drill",
      confirmation: "",
    })).toThrow(/ERASE_RESTORE_TARGET/);
  });

  it("bloqueia alvo com aparência de produção sem override explícito", () => {
    expect(() => assertRestoreSafety({
      sourceUrl: "mysql://u:p@db.example/w9_prod",
      targetUrl: "mysql://u:p@db.example/clientes",
      confirmation: "ERASE_RESTORE_TARGET",
    })).toThrow(/descartável|staging|override/i);
  });

  it("aceita alvo de restore drill separado", () => {
    expect(() => assertRestoreSafety({
      sourceUrl: "mysql://u:p@db.example/w9_prod",
      targetUrl: "mysql://u:p@db.example/w9_restore_drill",
      confirmation: "ERASE_RESTORE_TARGET",
    })).not.toThrow();
  });

  it("detecta dump corrompido de mesmo tamanho por SHA-256", () => {
    const dump = Buffer.from("CREATE TABLE t(id int);\n");
    const manifest = { sha256: computeSha256(dump), bytes: dump.length };
    const corrupted = Buffer.from("CREATE TABLE u(id int);\n");
    expect(corrupted.length).toBe(dump.length);
    expect(() => verifyManifest(dump, manifest)).not.toThrow();
    expect(() => verifyManifest(corrupted, manifest)).toThrow(/checksum|SHA-256/i);
  });
});

import { createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ParsedMysqlUrl = {
  raw: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  safeLabel: string;
};

export type BackupManifest = {
  version: 1;
  createdAt: string;
  sha256: string;
  bytes: number;
  source: { host: string; port: number; database: string };
};

const RESTORE_CONFIRMATION = "ERASE_RESTORE_TARGET";
const NON_DISPOSABLE_OVERRIDE = "I_UNDERSTAND_THIS_CAN_DESTROY_DATA";
const DISPOSABLE_DATABASE_PATTERN = /(restore|drill|test|staging|stage|sandbox|preview)/i;

function requireSafeOptionValue(value: string, label: string) {
  if (/\r|\n|\0/.test(value)) throw new Error(`${label} contém caracteres inválidos para o arquivo de credenciais.`);
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function parseMysqlUrl(raw: string | undefined, label: string): ParsedMysqlUrl {
  if (!raw?.trim()) throw new Error(`${label} é obrigatório.`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} não é uma URL válida.`);
  }
  if (url.protocol !== "mysql:" && url.protocol !== "mysql2:") throw new Error(`${label} deve usar protocolo mysql://.`);
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).trim();
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!url.hostname || !database || !user) throw new Error(`${label} deve informar host, banco e usuário.`);
  const port = url.port ? Number(url.port) : 3306;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} contém porta inválida.`);
  return {
    raw,
    host: url.hostname,
    port,
    user,
    password,
    database,
    safeLabel: `${url.hostname}:${port}/${database}`,
  };
}

export function buildClientConfig(parsed: ParsedMysqlUrl) {
  const host = requireSafeOptionValue(parsed.host, "host");
  const user = requireSafeOptionValue(parsed.user, "user");
  const password = requireSafeOptionValue(parsed.password, "password");
  return `[client]\nhost="${host}"\nport=${parsed.port}\nuser="${user}"\npassword="${password}"\nprotocol=tcp\n`;
}

function sameDatabase(a: ParsedMysqlUrl, b: ParsedMysqlUrl) {
  return a.host.toLowerCase() === b.host.toLowerCase() && a.port === b.port && a.database.toLowerCase() === b.database.toLowerCase();
}

export function assertRestoreSafety(input: {
  sourceUrl: string | undefined;
  targetUrl: string | undefined;
  confirmation: string | undefined;
  nonDisposableOverride?: string | undefined;
}) {
  const source = parseMysqlUrl(input.sourceUrl, "SOURCE_DATABASE_URL");
  const target = parseMysqlUrl(input.targetUrl, "RESTORE_DATABASE_URL");
  if (sameDatabase(source, target)) throw new Error("Restore recusado: origem e destino apontam para o mesmo banco.");
  if (input.confirmation !== RESTORE_CONFIRMATION) throw new Error(`Restore recusado: defina RESTORE_CONFIRM=${RESTORE_CONFIRMATION}.`);
  if (!DISPOSABLE_DATABASE_PATTERN.test(target.database) && input.nonDisposableOverride !== NON_DISPOSABLE_OVERRIDE) {
    throw new Error(`Restore recusado: o banco de destino não parece descartável/staging. Para recuperação real, exija revisão humana e defina RESTORE_NON_DISPOSABLE_OVERRIDE=${NON_DISPOSABLE_OVERRIDE}.`);
  }
  return { source, target };
}

export function computeSha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyManifest(dump: Buffer, manifest: Pick<BackupManifest, "sha256" | "bytes">) {
  if (dump.length !== manifest.bytes) throw new Error("Backup inválido: tamanho do dump diverge do manifesto.");
  const actual = Buffer.from(computeSha256(dump), "hex");
  const expected = Buffer.from(manifest.sha256, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Backup inválido: checksum SHA-256 não confere.");
}

async function withClientConfig<T>(parsed: ParsedMysqlUrl, action: (configPath: string) => Promise<T>) {
  const directory = await mkdtemp(resolve(tmpdir(), "w9-mysql-client-"));
  const configPath = resolve(directory, "client.cnf");
  try {
    await writeFile(configPath, buildClientConfig(parsed), { encoding: "utf8", mode: 0o600 });
    return await action(configPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function argsContainPassword(args: string[], password: string) {
  if (!password) return false;
  return args.some(arg => arg === password || arg.includes(`password=${password}`) || arg.includes(`:${password}@`));
}

function runProcess(input: {
  binary: string;
  args: string[];
  stdinPath?: string;
  stdoutPath?: string;
}) {
  return new Promise<void>((resolvePromise, reject) => {
    let settled = false;
    let processFinished = false;
    let outputFinished = !input.stdoutPath;
    let stderr = "";

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const maybeResolve = () => {
      if (settled || !processFinished || !outputFinished) return;
      settled = true;
      resolvePromise();
    };

    const child = spawn(input.binary, input.args, {
      shell: false,
      windowsHide: true,
      stdio: [input.stdinPath ? "pipe" : "ignore", input.stdoutPath ? "pipe" : "ignore", "pipe"],
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", chunk => {
      stderr = (stderr + chunk).slice(-64_000);
    });
    child.on("error", error => fail(new Error(`Cliente MySQL indisponível (${input.binary}): ${error.message}`)));
    child.on("close", code => {
      if (code !== 0) {
        fail(new Error(`${input.binary} encerrou com código ${code ?? "desconhecido"}${stderr ? `: ${stderr.trim()}` : ""}`));
        return;
      }
      processFinished = true;
      maybeResolve();
    });

    if (input.stdinPath && child.stdin) {
      const source = createReadStream(input.stdinPath);
      source.on("error", error => fail(error));
      source.pipe(child.stdin);
    }
    if (input.stdoutPath && child.stdout) {
      const destination = createWriteStream(input.stdoutPath, { flags: "w", mode: 0o600 });
      destination.on("error", error => fail(error));
      destination.on("finish", () => {
        outputFinished = true;
        maybeResolve();
      });
      child.stdout.pipe(destination);
    }
  });
}

export function buildDumpArgs(configPath: string, database: string) {
  return [
    `--defaults-extra-file=${configPath}`,
    "--single-transaction",
    "--quick",
    "--routines",
    "--events",
    "--triggers",
    "--hex-blob",
    "--skip-comments",
    database,
  ];
}

export function buildRestoreArgs(configPath: string, database: string) {
  return [`--defaults-extra-file=${configPath}`, database];
}

export async function backupDatabase(input: {
  databaseUrl?: string;
  outputPath: string;
  dumpBinary?: string;
}) {
  const source = parseMysqlUrl(input.databaseUrl ?? process.env.DATABASE_URL, "DATABASE_URL");
  const dumpBinary = input.dumpBinary ?? process.env.MYSQLDUMP_BINARY ?? "mysqldump";
  const outputPath = resolve(input.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await withClientConfig(source, async configPath => {
    const args = buildDumpArgs(configPath, source.database);
    if (argsContainPassword(args, source.password)) throw new Error("Falha de segurança: senha detectada nos argumentos do mysqldump.");
    await runProcess({ binary: dumpBinary, args, stdoutPath: outputPath });
  });
  const dump = await readFile(outputPath);
  const file = await stat(outputPath);
  if (!file.isFile() || file.size === 0) throw new Error("Backup inválido: mysqldump gerou arquivo vazio.");
  const manifest: BackupManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    sha256: computeSha256(dump),
    bytes: dump.length,
    source: { host: source.host, port: source.port, database: source.database },
  };
  const manifestPath = `${outputPath}.manifest.json`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { outputPath, manifestPath, manifest };
}

export async function restoreDatabase(input: {
  sourceUrl?: string;
  targetUrl?: string;
  confirmation?: string;
  nonDisposableOverride?: string;
  dumpPath: string;
  mysqlBinary?: string;
}) {
  const { target } = assertRestoreSafety({
    sourceUrl: input.sourceUrl ?? process.env.SOURCE_DATABASE_URL,
    targetUrl: input.targetUrl ?? process.env.RESTORE_DATABASE_URL,
    confirmation: input.confirmation ?? process.env.RESTORE_CONFIRM,
    nonDisposableOverride: input.nonDisposableOverride ?? process.env.RESTORE_NON_DISPOSABLE_OVERRIDE,
  });
  const dumpPath = resolve(input.dumpPath);
  const dump = await readFile(dumpPath);
  const manifest = JSON.parse(await readFile(`${dumpPath}.manifest.json`, "utf8")) as BackupManifest;
  verifyManifest(dump, manifest);
  const mysqlBinary = input.mysqlBinary ?? process.env.MYSQL_BINARY ?? "mysql";
  await withClientConfig(target, async configPath => {
    const args = buildRestoreArgs(configPath, target.database);
    if (argsContainPassword(args, target.password)) throw new Error("Falha de segurança: senha detectada nos argumentos do mysql.");
    await runProcess({ binary: mysqlBinary, args, stdinPath: dumpPath });
  });
  return { restored: true as const, target: target.safeLabel, sha256: manifest.sha256, bytes: manifest.bytes };
}

async function cli() {
  const [, , command, fileArg] = process.argv;
  if (command === "backup") {
    const outputPath = fileArg ?? process.env.BACKUP_OUTPUT ?? resolve("backups", `w9-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
    const result = await backupDatabase({ outputPath });
    console.log(JSON.stringify({ ok: true, command, outputPath: result.outputPath, manifestPath: result.manifestPath, sha256: result.manifest.sha256, bytes: result.manifest.bytes }));
    return;
  }
  if (command === "restore") {
    const dumpPath = fileArg ?? process.env.BACKUP_FILE;
    if (!dumpPath) throw new Error("Informe o dump como argumento ou BACKUP_FILE.");
    const result = await restoreDatabase({ dumpPath });
    console.log(JSON.stringify({ ok: true, command, ...result }));
    return;
  }
  throw new Error("Uso: tsx scripts/mysqlBackupRestore.ts <backup|restore> [dump.sql]");
}

const isDirectExecution = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isDirectExecution) {
  cli().catch(error => {
    console.error(error instanceof Error ? error.message : "Falha desconhecida no backup/restore.");
    process.exitCode = 1;
  });
}

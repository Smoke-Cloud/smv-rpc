import {
  type ChildProcess,
  spawn,
  type SpawnOptions,
} from "node:child_process";
import { mkdtempSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { createSmvRpc, type LaunchOpts, type SmvRpc } from "./rpc.ts";
import type {
  ConnectionSettings,
  ConnectionSettingsRequest,
} from "./jsonRpcCommon.ts";
import { SocketAddress } from "node:net";

export interface CommandOutput {
  success: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Uint8Array;
  stderr: Uint8Array;
}

const stdioOpts = { null: "ignore", piped: "pipe", inherit: "inherit" } as const;

export class SmokeviewProcess {
  private p: ChildProcess;
  private connectionSettingsRequest: ConnectionSettingsRequest;
  public output: CommandOutput | undefined;
  private smvPath: string;
  constructor(
    smvPath: string,
    opts?: LaunchOpts,
  ) {
    this.smvPath = smvPath;
    const cmd = opts?.smvBin ?? process.env.SMOKEVIEW_PATH ??
      (process.platform === "win32" ? "smvlua.cmd" : "smvlua");
    const args = [
      path.basename(this.smvPath),
    ];
    if (opts?.useTcp || process.platform === "win32") {
      const dir = mkdtempSync(path.join(tmpdir(), "smv.socket.dir."));
      const tcpConnectionInfoPath = path.join(dir, "connection");
      args.push("-tcp-file");
      args.push(tcpConnectionInfoPath);
      this.connectionSettingsRequest = {
        type: "tcp",
        path: tcpConnectionInfoPath,
      };
    } else {
      const dir = mkdtempSync(path.join(tmpdir(), "smv.socket.dir."));
      const socketPath = path.join(dir, "socket");
      args.push("-socket");
      args.push(socketPath);
      this.connectionSettingsRequest = {
        type: "unix",
        path: socketPath,
      };
    }
    const spawnOpts: SpawnOptions = {
      stdio: [
        "ignore",
        stdioOpts[opts?.stdout ?? "piped"],
        stdioOpts[opts?.stderr ?? "piped"],
      ],
      cwd: path.dirname(this.smvPath),
    };
    // Node can only run .cmd/.bat files on windows via a shell, in which case
    // we need to do the quoting ourselves.
    if (process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd)) {
      const line = [cmd, ...args].map((arg) => `"${arg}"`).join(" ");
      this.p = spawn(line, { ...spawnOpts, shell: true });
    } else {
      this.p = spawn(cmd, args, spawnOpts);
    }
    const stdout: Uint8Array[] = [];
    const stderr: Uint8Array[] = [];
    this.p.stdout?.on("data", (chunk) => stdout.push(chunk));
    this.p.stderr?.on("data", (chunk) => stderr.push(chunk));
    this.p.on("error", (e) => {
      this.output ??= {
        success: false,
        code: null,
        signal: null,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.from(e.message),
      };
    });
    this.p.on("close", (code, signal) => {
      this.output ??= {
        success: code === 0,
        code,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      };
    });
    this.p.ref();
  }
  async launch(): Promise<SmvRpc> {
    try {
      const socketExists = await this.waitForSocket();
      if (!socketExists) {
        if (this.output) {
          const stderr = (new TextDecoder()).decode(this.output.stderr);
          throw new Error(`no socket: "${stderr}"`);
        } else {
          throw new Error("Could not establish socket");
        }
      }
      const rpc = await createSmvRpc(this);
      return rpc;
    } catch (e) {
      this.close();
      throw e;
    }
  }
  async waitForSocket(): Promise<ConnectionSettings | null> {
    let exists: ConnectionSettings | null = null;
    if (this.connectionSettingsRequest.type === "tcp") {
      const socketDir = path.dirname(this.connectionSettingsRequest.path);
      // poll until socket file exists. We can't use stat to be compatible
      // with windows.
      let count = 0;
      while (count < 3 || (!exists && this.output === undefined)) {
        for (const dirEntry of await readdir(socketDir)) {
          if (
            dirEntry === path.basename(this.connectionSettingsRequest.path)
          ) {
            const s =
              (await readFile(this.connectionSettingsRequest.path, "utf8"))
                .trim();
            const v4 = SocketAddress.parse(s);
            if (!v4?.port) {
              throw new Error(`no tcp port in ${s}`);
            }
            if (!v4?.address) {
              throw new Error(`no tcp hostname in ${s}`);
            }
            exists = {
              type: "tcp",
              hostname: v4.address === "0.0.0.0" ? "127.0.0.1" : v4.address,
              port: v4.port,
            };
            break;
          }
        }
        count++;
        await sleep(1000);
      }
      return exists;
    } else {
      const socketDir = path.dirname(this.connectionSettingsRequest.path);
      // poll until socket file exists. We can't use stat to be compatible
      // with windows.
      let count = 0;
      while (count < 3 || (!exists && this.output === undefined)) {
        for (const dirEntry of await readdir(socketDir)) {
          if (
            dirEntry === path.basename(this.connectionSettingsRequest.path)
          ) {
            exists = {
              type: "unix",
              path: this.connectionSettingsRequest.path,
            };
            break;
          }
        }
        count++;
        await sleep(1000);
      }
      return exists;
    }
  }
  close() {
    // console.error("killing");
    // this.p.kill("SIGINT");
    // process.kill(this.p.pid, "SIGINT");
    this.p.ref();
  }
  [Symbol.dispose]() {
    this.close();
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

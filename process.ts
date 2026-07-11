import * as path from "@std/path";
import { createSmvRpc, type LaunchOpts, type SmvRpc } from "./rpc.ts";
import type {
  ConnectionSettings,
  ConnectionSettingsRequest,
} from "./jsonRpcCommon.ts";
import { SocketAddress } from "node:net";

export class SmokeviewProcess {
  private command: Deno.Command;
  private p: Deno.ChildProcess;
  private connectionSettingsRequest: ConnectionSettingsRequest;
  public output: Deno.CommandOutput | undefined;
  private smvPath: string;
  constructor(
    smvPath: string,
    opts?: LaunchOpts,
  ) {
    this.smvPath = smvPath;
    const cmd = opts?.smvBin ?? Deno.env.get("SMOKEVIEW_PATH") ??
      (Deno.build.os === "windows" ? "smvlua.cmd" : "smvlua");
    const args = [
      path.basename(this.smvPath),
    ];
    if (opts?.useTcp || Deno.build.os === "windows") {
      const dir = Deno.makeTempDirSync({ suffix: ".smv.socket.dir" });
      const tcpConnectionInfoPath = path.join(dir, "connection");
      args.push("-tcp-file");
      args.push(tcpConnectionInfoPath);
      this.connectionSettingsRequest = {
        type: "tcp",
        path: tcpConnectionInfoPath,
      };
    } else {
      const dir = Deno.makeTempDirSync({ suffix: ".smv.socket.dir" });
      const socketPath = path.join(dir, "socket");
      args.push("-socket");
      args.push(socketPath);
      this.connectionSettingsRequest = {
        type: "unix",
        path: socketPath,
      };
    }
    this.command = new Deno.Command(cmd, {
      stdin: "null",
      stdout: opts?.stdout ?? "piped",
      stderr: opts?.stderr ?? "piped",
      cwd: path.dirname(this.smvPath),
      args,
    });
    this.p = this.command.spawn();
    this.p.output().then((output) => this.output = output);
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
        for await (const dirEntry of Deno.readDir(socketDir)) {
          if (
            dirEntry.name === path.basename(this.connectionSettingsRequest.path)
          ) {
            const s =
              (await Deno.readTextFile(this.connectionSettingsRequest.path))
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
        for await (const dirEntry of Deno.readDir(socketDir)) {
          if (
            dirEntry.name === path.basename(this.connectionSettingsRequest.path)
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
    // Deno.kill(this.p.pid, "SIGINT");
    this.p.ref();
  }
  [Symbol.dispose]() {
    this.close();
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

import * as path from "jsr:@std/path@1.0.0";
import { SmvRpc } from "./rpc.ts";

export class SmokeviewProcess {
  private command: Deno.Command;
  private p: Deno.ChildProcess;
  private encoder: TextEncoder;
  public socketPath: string;
  public output: Deno.CommandOutput | undefined;
  private smvPath: string;
  constructor(
    smvPath: string,
    opts?: {
      smvBin?: string;
      stdout?: "null" | "piped" | "inherit" | undefined;
      stderr?: "null" | "piped" | "inherit" | undefined;
    },
  ) {
    this.smvPath = smvPath;
    const cmd = opts?.smvBin ?? Deno.env.get("SMOKEVIEW_PATH") ??
      (Deno.build.os === "windows" ? "smvlua.cmd" : "smvlua");
    this.socketPath = Deno.makeTempDirSync({ suffix: ".smv.socket.dir" });
    this.socketPath = path.join(this.socketPath, "socket");
    this.command = new Deno.Command(cmd, {
      stdin: "null",
      stdout: opts?.stdout ?? "piped",
      stderr: opts?.stderr ?? "piped",
      cwd: path.dirname(this.smvPath),
      args: [
        this.smvPath,
        "-socket",
        this.socketPath,
      ],
    });
    this.p = this.command.spawn();
    this.p.output().then((output) => this.output = output);
    this.p.ref();
    this.encoder = new TextEncoder();
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
      return new SmvRpc(this);
    } catch (e) {
      this.close();
      throw e;
    }
  }
  async waitForSocket(): Promise<boolean> {
    let exists = false;
    const socketDir = path.dirname(this.socketPath);
    // poll until socket file exists. We can't use stat to be compatible
    // with windows.
    while (!exists && this.output === undefined) {
      for await (const dirEntry of Deno.readDir(socketDir)) {
        if (dirEntry.name === path.basename(this.socketPath)) {
          exists = true;
          break;
        }
      }
    }
    return exists;
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

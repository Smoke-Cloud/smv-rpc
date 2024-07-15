import * as path from "jsr:@std/path@1.0.0";
import { SmvRpc } from "./rpc.ts";

export class SmokeviewProcess {
  private command: Deno.Command;
  private p: Deno.ChildProcess;
  private encoder: TextEncoder;
  public socketPath: string;
  constructor(private smvPath: string) {
    const cmd = Deno.build.os === "windows" ? "smvlua.cmd" : "smvlua";
    this.socketPath = Deno.makeTempDirSync({ suffix: ".smv.socket.dir" });
    this.socketPath = path.join(this.socketPath, "socket");
    this.command = new Deno.Command(cmd, {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      cwd: path.dirname(this.smvPath),
      args: [
        this.smvPath,
        "-socket",
        this.socketPath,
      ],
    });
    this.p = this.command.spawn();
    this.p.ref();
    this.encoder = new TextEncoder();
  }
  async launch(): Promise<SmvRpc> {
    try {
      // poll until socket file exists. We can't use stat to be compatible
      // with windows.
      console.log(this.socketPath);
      let exists = false;
      const socketDir = path.dirname(this.socketPath);
      while (!exists) {
        for await (const dirEntry of Deno.readDir(socketDir)) {
          console.log(dirEntry.name);
          if (dirEntry.name === path.basename(this.socketPath)) {
            exists = true;
            break;
          }
        }
      }
      return new SmvRpc(this);
    } catch (e) {
      this.close();
      throw e;
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

import type { JsonRpcParams, JsonRpcResult } from "./jsonrpccommon.ts";
import { JsonRpcClientWin } from "./jsonrpcwin.ts";
import type { JsonRpcClient } from "./mod.ts";
import { SmokeviewProcess } from "./process.ts";

export class SmvRpc {
  public rpc: JsonRpcClient;
  private process: SmokeviewProcess;
  constructor(process: SmokeviewProcess) {
    this.rpc = new JsonRpcClientWin(process.socketPath);
    this.process = process;
  }
  async call(method: string, params?: JsonRpcParams): Promise<JsonRpcResult> {
    return await this.rpc.call(method, params);
  }
  async notify(method: string, params?: JsonRpcParams): Promise<JsonRpcResult> {
    return await this.rpc.notify(method, params);
  }
  close() {
    this.rpc.close();
    this.process.close();
  }
}

export type LaunchOpts = {
  smvBin?: string;
  stdout?: "null" | "piped" | "inherit" | undefined;
  stderr?: "null" | "piped" | "inherit" | undefined;
};

export async function startSmvRpc(
  smvPath: string,
  opts?: LaunchOpts,
): Promise<SmvRpc> {
  const smv = new SmokeviewProcess(smvPath, opts);
  const smvRpc = await smv.launch();
  return smvRpc;
}

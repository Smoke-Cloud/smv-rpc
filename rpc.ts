import {
  createJsonRpcClientUnix,
  type JsonRpcClient,
} from "./jsonRpcClient.ts";
import type { JsonRpcParams, JsonRpcResult } from "./jsonRpcCommon.ts";
import { SmokeviewProcess } from "./process.ts";

export async function createSmvRpc(
  process: SmokeviewProcess,
) {
  const connectionSettings = await process.waitForSocket();
  if (!connectionSettings) throw new Error("no connection");
  return new SmvRpc(
    process,
    await createJsonRpcClientUnix(connectionSettings),
  );
}
export class SmvRpc {
  public rpc: JsonRpcClient;
  private process: SmokeviewProcess;
  constructor(
    process: SmokeviewProcess,
    rpc: JsonRpcClient,
  ) {
    this.process = process;
    this.rpc = rpc;
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
  useTcp?: boolean;
};

export async function startSmvRpc(
  smvPath: string,
  opts?: LaunchOpts,
): Promise<SmvRpc> {
  const smv = new SmokeviewProcess(smvPath, opts);
  const smvRpc = await smv.launch();
  return smvRpc;
}

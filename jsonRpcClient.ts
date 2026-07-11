import {
  type ConnectionSettings,
  isJsonRpcResponse,
  type JsonRpcParams,
  type JsonRpcRequest,
  JsonRpcRequestStream,
  type JsonRpcResponse,
  JsonRpcResponseStream,
  type JsonRpcResult,
} from "./jsonRpcCommon.ts";
import { SplitJsonObjectsStream } from "./rstream.ts";

export async function createJsonRpcClientUnix(
  opts: ConnectionSettings,
) {
  switch (opts.type) {
    case "unix":
      return new JsonRpcClient(
        await Deno.connect({
          transport: "unix",
          path: opts.path,
        }),
      );
    case "tcp":
      return new JsonRpcClient(
        await Deno.connect({
          transport: "tcp",
          hostname: opts.hostname,
          port: opts.port,
        }),
      );
    default:
      throw new Error("invalid connectio type");
  }
}

/**
 * A JSON-RPC client that operates over a UNIX socket or a TCP socket.
 */
export class JsonRpcClient {
  private n = 0;
  private conn: Deno.UnixConn | Deno.TcpConn;

  // TODO: there doesn't seem to be a reason to keep the readable and writeable
  // streams around once we've locked them, but that may change.
  private sendQueue: WritableStreamDefaultWriter<JsonRpcRequest>;
  // private sendStream: ReadableStream<Uint8Array<ArrayBuffer>>;

  private responseQueue: ReadableStreamDefaultReader<JsonRpcResponse>;
  // private responseStream: ReadableStream<JsonRpcResponse>;
  constructor(conn: Deno.UnixConn | Deno.TcpConn) {
    this.conn = conn;
    const reqStream = new JsonRpcRequestStream();

    const sendStream = reqStream.readable.pipeThrough(new TextEncoderStream());
    sendStream.pipeTo(this.conn.writable);
    this.sendQueue = reqStream.writable.getWriter();

    const responseStream = this.conn.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new SplitJsonObjectsStream())
      .pipeThrough(new JsonRpcResponseStream());
    this.responseQueue = responseStream.getReader();
  }
  private async send(
    method: string,
    params?: JsonRpcParams,
    requestId?: number,
  ) {
    let requestObject: JsonRpcRequest;
    if (requestId !== undefined) {
      requestObject = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": requestId,
      };
    } else {
      requestObject = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
      };
    }
    await this.sendQueue.write(requestObject);
  }
  private async recv(): Promise<object | undefined> {
    return (await this.responseQueue.read()).value;
  }
  /**
   * Send a JSON-RPC message wait for a response.
   */
  public async call(
    method: string,
    params?: JsonRpcParams,
  ): Promise<JsonRpcResult> {
    const requestId = this.n;
    await this.send(method, params, requestId);
    this.n++;
    // TODO: make sure ids correspond. This may mean keeping some kind of buffer
    // and a list of calls to return.
    const r = await this.recv();
    if (r && isJsonRpcResponse(r)) {
      if (r.id !== requestId) {
        throw new Error(`reponse id is ${r.id} should be ${requestId}`);
      }
      return r.result;
    } else {
      console.error("Error:", r);
    }
  }
  /**
   * Send a JSON-RPC message with no id and don't wait for a response.
   */
  public async notify(method: string, params?: JsonRpcParams) {
    await this.send(method, params);
  }
  close() {
  }
}

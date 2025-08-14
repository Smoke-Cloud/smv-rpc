import {
  isJsonRpcResponse,
  type JsonRpcParams,
  type JsonRpcResult,
} from "./jsonrpccommon.ts";
import { SplitJsonObjectsStream } from "./rstream.ts";

export class JsonRpcClientUnix {
  private writeStream = new TextEncoderStream();
  private writer?: WritableStreamDefaultWriter<string>;
  private responseStream?: ReadableStream<object>;
  private textStream?: ReadableStream<string>;
  private objectStream?: ReadableStream<object>;
  private reader?: ReadableStreamDefaultReader<object>;
  private n = 0;
  private conn?: Deno.UnixConn;
  private socketPath: string;
  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }
  async init() {
    this.conn = await Deno.connect({
      transport: "unix",
      path: this.socketPath,
    });
    /*await*/ this.writeStream.readable.pipeTo(this.conn.writable);
    this.writer = this.writeStream.writable.getWriter();
    this.textStream = this.conn.readable.pipeThrough(
      new TextDecoderStream(),
    );
    this.objectStream = this.textStream.pipeThrough(
      new SplitJsonObjectsStream(),
    );
    this.reader = this.objectStream.getReader();
    this.responseStream = new ReadableStream({
      start(_controller) {
        /* … */
      },

      async pull(_controller) {
        // let response = "";
        // const objectStrings = [];
        // let singleObj = "";
        // const textStream = conn.readable.pipeThrough(
        //     new TextDecoderStream(),
        // );
        // const reader = textStream.getReader();
        // // while (true) {
        // const { value, done } = await reader.read();
        // if (value) {
        //     // const s = decoder.decode(value);
        //     for (const c of value) {
        //         singleObj += c;
        //         if (c == "}") {
        //             objectStrings.push(singleObj);
        //             singleObj = "";
        //             // break;
        //         }
        //     }
        //     response += value;
        // }
        // //     if (done) {
        // //         break;
        // //     }
        // // }
        // const t: object[] = objectStrings.map((s) => JSON.parse(s));
      },

      cancel(_reason) {
        /* … */
      },
    });
  }
  async send(obj: object) {
    if (!this.writer) throw new Error("rpc not initialized");
    await this.writer.write(JSON.stringify(obj));
  }
  // TODO: create a stream of JSON objects
  async recv(): Promise<object | undefined> {
    if (!this.reader) throw new Error("rpc not initialized");
    return (await this.reader.read()).value;
  }
  async call(
    method: string,
    params?: JsonRpcParams,
  ): Promise<JsonRpcResult> {
    if (!this.reader) throw new Error("rpc not initialized");
    const requestId = this.n;
    await this.send({
      "jsonrpc": "2.0",
      "method": method,
      "params": params,
      "id": requestId,
    });
    this.n++;
    // TODO: make sure ids correspond
    const r = (await this.reader.read()).value;
    if (r && isJsonRpcResponse(r)) {
      if (r.id !== requestId) {
        throw new Error(`reponse id is ${r.id} should be ${requestId}`);
      }
      return r.result;
    } else {
      console.error("Error:", r);
    }
  }
  async notify(method: string, params?: JsonRpcParams) {
    await this.send({
      "jsonrpc": "2.0",
      "method": method,
      "params": params,
    });
  }
  close() {
  }
}

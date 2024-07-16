import {
  isJsonRpcResponse,
  type JsonRpcParams,
  type JsonRpcResult,
} from "./jsonrpccommon.ts";

// Determine library extension based on
// your OS.
let libSuffix = "";
switch (Deno.build.os) {
  case "windows":
    libSuffix = "dll";
    break;
  case "darwin":
    libSuffix = "dylib";
    break;
  default:
    libSuffix = "so";
    break;
}

const libName = `./bin/jsonrpc.${libSuffix}`;
// Open library and define exported symbols

export class JsonRpcClientWin {
  private n = 0;
  private dylib = Deno.dlopen(
    libName,
    {
      "print_something": { parameters: [], result: "void" },
      "jrpc_send_request_s": {
        parameters: ["pointer", "buffer", "buffer"],
        result: "void",
      },
      "jrpc_client_create_ptr": { parameters: [], result: "pointer" },
      "pop_or_block_s": { parameters: ["pointer"], result: "buffer" },
      "jrpc_client_connect_ptr": {
        parameters: ["pointer", "buffer"],
        result: "pointer",
      },
      "jrpc_client_destroy_ptr": {
        parameters: ["pointer"],
        result: "void",
      },
      "connection_destroy": {
        parameters: ["pointer"],
        result: "void",
      },
    } as const,
  );
  private client: Deno.PointerValue<unknown>;
  private conn: Deno.PointerValue<unknown>;
  constructor(public socketPath: string) {
    this.client = this.dylib.symbols
      .jrpc_client_create_ptr();
    this.conn = this.dylib.symbols.jrpc_client_connect_ptr(
      this.client,
      new TextEncoder().encode(`${this.socketPath}\0`),
    );
  }
  private async send(method: string, params?: JsonRpcParams) {
    const methodBuffer = new TextEncoder().encode(`${method}\0`);
    const paramsBuffer = new TextEncoder().encode(
      `${JSON.stringify(params)}\0`,
    );
    this.dylib.symbols.jrpc_send_request_s(
      this.conn,
      methodBuffer,
      paramsBuffer,
    );
  }
  // TODO: create a stream of JSON objects
  async recv(): Promise<object | undefined> {
    const response = this.dylib.symbols.pop_or_block_s(this.conn);
    if (response) {
      const dataView = new Deno.UnsafePointerView(response);
      const responseS = dataView.getCString();
      try {
        const responseJson = JSON.parse(responseS);
        return responseJson;
      } catch (e) {
        console.error("could not parse: ", responseS);
        throw e;
      }
    } else {
      console.log("no response");
    }
  }
  async call(method: string, params?: JsonRpcParams): Promise<JsonRpcResult> {
    await this.send(method, params);
    this.n++;
    // TODO: make sure ids correspond
    const r = await this.recv();
    if (r && isJsonRpcResponse(r)) {
      return r.result;
    } else {
      console.error(r);
    }
  }
  async notify(method: string, params?: JsonRpcParams) {
    await this.send(method, params);
  }
  close() {
    console.log("conn", this.conn);
    this.dylib.symbols.connection_destroy(this.conn);
    this.dylib.symbols.jrpc_client_destroy_ptr(this.client);
    this.dylib.close();
  }
  [Symbol.dispose]() {
    this.close();
  }
}

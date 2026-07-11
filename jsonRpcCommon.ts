export type JsonRpcParams = object | unknown[];
export type JsonRpcResult = unknown;

export type ConnectionSettingsRequest = { type: "unix"; path: string } | {
  type: "tcp";
  path: string;
};

export type ConnectionSettings =
  | UnixSocketConnectionSettings
  | TcpSocketConnectionSettings;

export type UnixSocketConnectionSettings = { type: "unix"; path: string };
export type TcpSocketConnectionSettings = {
  type: "tcp";
  hostname: string;
  port: number;
};

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: object | unknown[];
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: JsonRpcParams;
}
export function isJsonRpcResponse(o: object): o is JsonRpcResponse {
  return "jsonrpc" in o && o["jsonrpc"] === "2.0" && "id" in o;
}

export class JsonRpcRequestStream
  extends TransformStream<JsonRpcRequest, string> {
  constructor() {
    super({
      start() {}, // required.
      async transform(
        chunk: JsonRpcRequest,
        controller: TransformStreamDefaultController<string>,
      ) {
        // chunk = await chunk;
        controller.enqueue(`${JSON.stringify(chunk)}\0`);
      },
      flush() {
        /* do any destructor work here */
      },
    });
  }
}

export class JsonRpcResponseStream
  extends TransformStream<object, JsonRpcResponse> {
  constructor() {
    super({
      start() {}, // required.
      async transform(
        chunk: object,
        controller: TransformStreamDefaultController<JsonRpcResponse>,
      ) {
        // chunk = await chunk;
        controller.enqueue(chunk as JsonRpcResponse);
      },
      flush() {
        /* do any destructor work here */
      },
    });
  }
}

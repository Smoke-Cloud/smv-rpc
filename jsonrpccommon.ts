export type JsonRpcParams = object | unknown[];
export type JsonRpcResult = unknown;

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
export function isJsonRpcResponse(o: object): o is JsonRpcResponse {
  return "jsonrpc" in o && o["jsonrpc"] === "2.0" && "id" in o &&
    "result" in o;
}

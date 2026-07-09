// import { JsonRpcRequestStream } from "./jsonrpccommon.ts";

import { createJsonRpcClientUnix } from "./jsonrpcunix.ts";

// const sendQueue = new JsonRpcRequestStream();
// const writer = sendQueue.writable.getWriter();
// writer.write({
//   "jsonrpc": "2.0",
//   "method": "something",
//   "params": [1, 2, 3],
//   "id": 1,
// });
// // const reader = sendQueue.readable.getReader();
// setTimeout(async () => {
//   for await (const r of sendQueue.readable) {
//     console.log("read:", r);
//   }
// });
// writer.write({
//   "jsonrpc": "2.0",
//   "method": "something",
//   "params": [1, 2, 3],
//   "id": 2,
// });

const t = await createJsonRpcClientUnix("/tmp/my.sock");
t.call("hello", ["jake"]);
t.call("hello", ["bob"]);

import { Smokeview } from "./mod.ts";

const smvFile = "C:/Users/josha/Documents/room_fire/couch.smv";
using smv = await Smokeview.launch(smvFile, {
  smvBin: "C:/Users/josha/Documents/smv/.vscode/build/Debug/smokeview.exe",
});
const indices = [];
for (const slice of await smv.getSlices()) {
  if (slice.shortlabel === "temp") {
    console.log(slice);
    indices.push(slice.index);
  }
}
console.log(await smv.getNGlobalTimes());
for (const index of indices) {
  await smv.loadSlices([{ index, frame: 10 }]);
}
console.log(await smv.getNGlobalTimes());
// await smv.loadSlices([{ index: 0 }]);
// await smv.loadSlices([{ index: 1 }]);
await smv.setCameraXMax();
// await smv.setFrame(30);
await smv.render("test_pic");
// for (;;){}

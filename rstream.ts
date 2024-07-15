const transformContent = {
  inString: false,
  objectDepth: 0,
  buffer: "",
  start() {}, // required.
  transform(
    chunk: string | null,
    controller: TransformStreamDefaultController,
  ) {
    // console.log("this.buffer:", this.buffer);
    // console.log("chunk:", chunk);
    if (chunk === null) {
      controller.terminate();
      return;
    }
    for (const c of chunk) {
      if (this.inString) {
        // TODO: handle escaped quotes
        if (c === '"') this.inString = false;
        this.buffer += c;
        continue;
      }
      let done = false;
      switch (c) {
        case "{":
          this.objectDepth++;
          break;
        case "}":
          this.objectDepth--;
          if (this.objectDepth === 0) done = true;
          // console.log(
          //     " this.objectDepth",
          //     this.objectDepth,
          // );
          break;

        default:
          break;
      }
      this.buffer += c;
      if (done) {
        // TODO: error handling
        controller.enqueue(JSON.parse(this.buffer));
        this.buffer = "";
      }
    }
    // console.log("controller.buffer:", this.buffer);
  },
  flush() {
    /* do any destructor work here */
  },
};

export class SplitJsonObjectsStream extends TransformStream {
  constructor() {
    super({
      ...transformContent,
    });
  }
}

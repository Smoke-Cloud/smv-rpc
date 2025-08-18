import type { JsonRpcClientUnix } from "./jsonrpcunix.ts";
import type { JsonRpcClientWin } from "./jsonrpcwin.ts";
export { type LaunchOpts, type SmvRpc, startSmvRpc } from "./rpc.ts";
import type { JsonRpcParams, JsonRpcResult } from "./jsonrpccommon.ts";
import { type LaunchOpts, type SmvRpc, startSmvRpc } from "./rpc.ts";
export type JsonRpcClient = JsonRpcClientUnix | JsonRpcClientWin;

export interface Slice {
  longlabel: string;
  shortlabel: string;
  index: number;
  idir: number;
  position_orig: number;
  mesh: number;
}

export interface Mesh {
  xplt_orig: number[];
  yplt_orig: number[];
  zplt_orig: number[];
  i: number;
  j: number;
  k: number;
}

export interface Smoke3d {
  longlabel: string;
  index: number;
}
export class Smokeview {
  private vectors?: CsvVectors;
  private smvRpc: SmvRpc;
  constructor(smvRpc: SmvRpc) {
    this.smvRpc = smvRpc;
  }
  static async launch(
    smvPath: string,
    opts?: LaunchOpts,
  ): Promise<Smokeview> {
    const rpc = await startSmvRpc(smvPath, opts);
    return new Smokeview(rpc);
  }
  [Symbol.dispose](): void {
    this.exit();
  }
  async setClipping(
    params: {
      mode?: 2;
      x?: { min?: number | null; max?: number | null };
      y?: { min?: number | null; max?: number | null };
      z?: { min?: number | null; max?: number | null };
    },
  ) {
    await this.smvRpc.call("set_clipping", params);
  }
  async setChidVisibility(set: boolean) {
    await this.call("set_chid_visibility", [set]);
  }
  async setTitleVisibility(set: boolean) {
    await this.call("set_title_visibility", [set]);
  }
  async setSmvVersionVisibility(set: boolean) {
    await this.call("set_smv_version_visibility", [set]);
  }
  async setWindowSize(width: number, height: number) {
    await this.call("set_window_size", { width, height });
  }
  async getSmoke3ds(): Promise<Smoke3d[]> {
    return await this.call("get_smoke3ds") as Smoke3d[];
  }

  async blockagesHideAll(): Promise<void> {
    await this.call("blockages_hide_all");
  }
  async sufacesHideAll(): Promise<void> {
    await this.call("surfaces_hide_all");
  }
  async outlinesHideAll(): Promise<void> {
    await this.call("outlines_hide_all");
  }
  async devicesHideAll(): Promise<void> {
    await this.call("devices_hide_all");
  }

  async setRenderDir(dir: string): Promise<void> {
    await this.call("set_render_dir", [dir]);
  }
  async setRenderType(type: string): Promise<void> {
    await this.call("set_render_type", [type]);
  }

  async loadSmoke3dIndices(indices: number[]) {
    await this.call("load_smoke3d_indices", indices);
  }
  async setFrame(frameNumber: number) {
    await this.call("set_frame", [frameNumber]);
  }
  async unloadAll() {
    await this.call("unload_all");
  }
  async getSlices(): Promise<Slice[]> {
    return (await this.call("get_slices")) as Slice[];
  }
  async getMeshes(): Promise<Mesh[]> {
    return await this.call("get_meshes") as Mesh[];
  }
  async loadSliceStd(type: string, axis: 1 | 2 | 3, distance: number) {
    const slices = await this.getSlices();
    const meshes = await this.getMeshes();
    const sliceIndices = slices.filter((
      c: Slice,
    ) => {
      const mesh = meshes[c.mesh];
      const cellWidth = findCellDimension(mesh, c.idir, distance);
      if (!cellWidth) return false;
      return c.longlabel === type && c.idir === axis &&
        c.position_orig > (distance - cellWidth * 0.25) &&
        c.position_orig < (distance + cellWidth * 0.25);
    });
    await this.loadSliceIndices(
      sliceIndices.map((c: Slice) => c.index - 1),
    );
  }
  async loadSliceIndices(indices: number[]): Promise<void> {
    await this.call("load_slice_indices", indices);
  }
  async loadSlices(specs: { index: number; frame?: number }[]): Promise<void> {
    await this.call("load_slices", { specs });
  }
  async setCameraXMin() {
    await this.setOrthoPreset("XMIN");
  }
  async setCameraXMax() {
    await this.setOrthoPreset("XMAX");
  }
  async setCameraYMin() {
    await this.setOrthoPreset("YMIN");
  }
  async setCameraYMax() {
    await this.setOrthoPreset("YMAX");
  }
  async setCameraZMin() {
    await this.setOrthoPreset("ZMIN");
  }
  async setCameraZMax() {
    await this.setOrthoPreset("ZMAX");
  }
  async setCameraEye(x: number, y: number, z: number) {
    await this.call("set_camera_eye", [x, y, z]);
  }
  async setCameraZoom(zoom: number) {
    await this.call("set_camera_zoom", [zoom]);
  }
  async setCameraViewDir(x: number, y: number, z: number) {
    await this.call("set_camera_view_dir", [x, y, z]);
  }
  async setOrthoPreset(view: string) {
    await this.call("set_ortho_preset", [view]);
  }
  async setTime(time: number) {
    await this.call("set_time", [time]);
  }
  async getNGlobalTimes(): Promise<number | undefined> {
    return await this.call("get_n_global_times") as number | undefined;
  }
  async getTime(): Promise<number | undefined> {
    return await this.call("get_time") as number | undefined;
  }
  async getCsvVectors(): Promise<CsvVectors> {
    if (this.vectors) return this.vectors;
    this.vectors = await this.call("get_csv_vectors") as CsvVectors;
    return this.vectors;
  }
  async getCsvSet(
    type: string,
  ): Promise<Record<string, DataVector<number, number>> | undefined> {
    const vectors = await this.getCsvVectors();
    return vectors[type];
  }
  async getCsv(
    type: string,
    id: string,
  ): Promise<DataVector<number, number> | undefined> {
    const set = await this.getCsvSet(type);
    if (!set) return;
    return set[id];
  }
  async setTimeEnd() {
    const nframes = await this.getNGlobalTimes();
    if (nframes != undefined) this.setFrame(nframes - 1);
  }
  async setOrthographic() {
    await this.setProjectionType(1);
  }
  async setProjectionType(projectionType: number) {
    await this.call("set_projection_type", [projectionType]);
  }
  async setColorbar(colorbarName: string) {
    await this.call("set_colorbar", [colorbarName]);
  }
  async setColorbarFlip(set: boolean) {
    await this.call("set_colorbar_flip", [set]);
  }
  async setCameraAz(value: number) {
    await this.call("set_camera_az", [value]);
  }
  async setCameraElev(value: number) {
    await this.call("set_camera_elev", [value]);
  }
  async setFontSize(fontSize: string) {
    await this.call("set_font_size", [fontSize]);
  }
  async setSliceBounds(type: string, bounds: {
    min?: number | null;
    max?: number | null;
  }) {
    const params = {
      type,
      set_min: bounds.min !== null,
      value_min: bounds.min,
      set_max: bounds.max !== null,
      value_max: bounds.max,
    };
    await this.call("set_slice_bounds", params);
  }
  async render(basename?: string, options?: { basename?: string }) {
    let opts = options;
    if (basename) {
      if (!opts) opts = {};
      opts.basename = basename;
    }
    await this.call("render", opts);
  }
  async exit() {
    await this.smvRpc.notify("exit");
    this.smvRpc.close();
  }
  close() {}
  async call(method: string, params?: JsonRpcParams): Promise<JsonRpcResult> {
    return await this.smvRpc.call(method, params);
  }
}

export type CsvVectors = Record<
  string,
  Record<string, DataVector<number, number>>
>;

export function findCellDimension(
  mesh: Mesh,
  axis: number,
  distance: number,
): number | undefined {
  let orig_plt;
  let bar;
  if (axis === 1) {
    orig_plt = mesh.xplt_orig;
    bar = mesh.i;
  } else if (axis === 2) {
    orig_plt = mesh.yplt_orig;
    bar = mesh.j;
  } else if (axis === 3) {
    orig_plt = mesh.zplt_orig;
    bar = mesh.k;
  } else {
    throw new Error("invalid axis");
  }
  //   -- TODO: Account for being slightly out.
  for (let i = 0; i < bar - 2; i++) {
    if (orig_plt[i] <= distance && distance <= orig_plt[i + 1]) {
      return (orig_plt[i + 1] - orig_plt[i]);
    }
  }
  // TODO: currently this is just a fallback
  return 0.1;
}

export interface DataVector<X, Y> {
  name: string;
  x: {
    name: string;
    units: string;
  };
  y: {
    name: string;
    units: string;
  };
  values: { x: X; y: Y }[];
}

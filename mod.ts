import type { JsonRpcClientUnix } from "./jsonrpcunix.ts";
import type { JsonRpcClientWin } from "./jsonrpcwin.ts";
import { type SmvRpc, startSmvRpc } from "./rpc.ts";
import type { JsonRpcParams, JsonRpcResult } from "./jsonrpccommon.ts";
export type JsonRpcClient = JsonRpcClientUnix | JsonRpcClientWin;

export interface Slice {
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
  constructor(private smvRpc: SmvRpc) {
  }
  static async launch(smvPath: string): Promise<Smokeview> {
    const rpc = await startSmvRpc(smvPath);
    return new Smokeview(rpc);
  }
  async setClipping(
    params: {
      mode?: 2;
      x?: { min?: number; max?: number };
      y?: { min?: number; max?: number };
      z?: { min?: number; max?: number };
    },
  ) {
    await this.smvRpc.call("set_clipping", params);
  }
  async setChidVisibility(set: boolean) {
    this.call("set_chid_visibility", [set]);
  }
  async setTitleVisibility(set: boolean) {
    this.call("set_title_visibility", [set]);
  }
  async setSmvVersionVisibility(set: boolean) {
    this.call("set_smv_version_visibility", [set]);
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
    return await this.call("get_slices") as Slice[];
  }
  async getMeshes(): Promise<Mesh[]> {
    return await this.call("get_meshes") as Mesh[];
  }

  async loadSliceIndices(indices: number[]): Promise<void> {
    await this.call("load_slice_indices", indices);
  }
  async setOrthoPreset(view: string) {
    await this.call("set_ortho_preset", [view]);
  }
  async setTime(time: number) {
    await this.call("set_time", [time]);
  }
  async setProjectionType(projectionType: number) {
    await this.call("set_projection_type", [projectionType]);
  }
  async setColorbar(colorbarName: string) {
    await this.call("set_colorbar", [colorbarName]);
  }
  async setFontSize(fontSize: string) {
    await this.call("set_font_size", [fontSize]);
  }
  async setSliceBounds(params: {
    type: string;
    set_min: boolean;
    value_min: number;
    set_max: boolean;
    value_max: number;
  }) {
    await this.call("set_slice_bounds", params);
  }
  async render(options?: { basename?: string }) {
    await this.call("render", options);
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

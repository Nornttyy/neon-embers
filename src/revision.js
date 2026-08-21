export const ASSET_REVISION = "__ASSET_REVISION__";

export function assetUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${ASSET_REVISION}`;
}

export const ASSET_REVISION = "e5f35dc50966";

export function assetUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${ASSET_REVISION}`;
}

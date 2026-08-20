export const ASSET_REVISION = "7f476bf7a61b";

export function assetUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${ASSET_REVISION}`;
}

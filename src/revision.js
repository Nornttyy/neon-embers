export const ASSET_REVISION = "e41b17a4330b";

export function assetUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${ASSET_REVISION}`;
}

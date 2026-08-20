export const ASSET_REVISION = "2d2113e208de";

export function assetUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${ASSET_REVISION}`;
}

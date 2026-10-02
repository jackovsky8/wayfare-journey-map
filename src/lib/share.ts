import type { AppSettings, JourneyItem } from "../types";

export interface SharedJourney {
  version: 1;
  items: JourneyItem[];
  settings: Omit<AppSettings, "mapboxToken">;
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

const base64ToBytes = (value: string) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const encodeJourney = (journey: SharedJourney) =>
  bytesToBase64(new TextEncoder().encode(JSON.stringify(journey)));

export const decodeJourney = (value: string): SharedJourney => {
  const decoded = JSON.parse(
    new TextDecoder().decode(base64ToBytes(value)),
  ) as SharedJourney;
  if (
    decoded.version !== 1 ||
    !Array.isArray(decoded.items) ||
    !decoded.settings
  )
    throw new Error("This shared journey link is not valid.");
  return decoded;
};

export const journeyUrl = (
  journey: SharedJourney,
  location: Pick<Location, "origin" | "pathname">,
) => `${location.origin}${location.pathname}?journey=${encodeJourney(journey)}`;

export const shareSizeWarning = (url: string, photoCount: number) => {
  if (url.length > 12_000)
    return `This link is very large (${Math.round(url.length / 1000)} kB). Remove photographs before creating a QR code.`;
  if (url.length > 3_000 || photoCount > 1)
    return "This QR code contains a lot of data and may be difficult for some cameras to scan.";
  return "";
};

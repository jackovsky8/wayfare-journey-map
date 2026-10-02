import type { AppSettings, JourneyItem } from "../types";

export interface SharedJourney {
  version: 2;
  name: string;
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
    decoded.version !== 2 ||
    typeof decoded.name !== "string" ||
    !Array.isArray(decoded.items) ||
    !decoded.settings
  )
    throw new Error("This journey code is not valid.");
  return decoded;
};

export interface QrFrame {
  protocol: "wayfare-qr-1";
  transferId: string;
  index: number;
  total: number;
  checksum: string;
  data: string;
}

export const checksum = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const createQrFrames = (encoded: string, chunkSize = 620): string[] => {
  const total = Math.ceil(encoded.length / chunkSize);
  const transferId = checksum(`${encoded.length}:${encoded.slice(0, 128)}`);
  const digest = checksum(encoded);
  return Array.from({ length: total }, (_, index) =>
    JSON.stringify({
      protocol: "wayfare-qr-1",
      transferId,
      index,
      total,
      checksum: digest,
      data: encoded.slice(index * chunkSize, (index + 1) * chunkSize),
    } satisfies QrFrame),
  );
};

export const acceptQrFrame = (
  frames: Map<number, string>,
  raw: string,
  expectedTransferId?: string,
) => {
  const frame = JSON.parse(raw) as QrFrame;
  if (
    frame.protocol !== "wayfare-qr-1" ||
    !Number.isInteger(frame.index) ||
    frame.index < 0 ||
    frame.index >= frame.total ||
    (expectedTransferId && frame.transferId !== expectedTransferId)
  )
    throw new Error("This is not a compatible Wayfare QR frame.");
  frames.set(frame.index, frame.data);
  if (frames.size !== frame.total)
    return { frame, complete: false as const, value: "" };
  const value = Array.from({ length: frame.total }, (_, index) =>
    frames.get(index),
  ).join("");
  if (checksum(value) !== frame.checksum)
    throw new Error("The QR transfer did not pass its integrity check.");
  return { frame, complete: true as const, value };
};

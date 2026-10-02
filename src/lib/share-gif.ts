import qrcode from "qrcode-generator";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export async function createAnimatedQrGif(frames: string[]) {
  if (!frames.length) throw new Error("There are no QR frames to share.");
  const size = 520;
  const qrSize = 450;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot create the QR animation.");
  const gif = GIFEncoder();

  for (let index = 0; index < frames.length; index += 1) {
    const qr = qrcode(0, "M");
    qr.addData(frames[index], "Byte");
    qr.make();
    const image = await loadImage(qr.createDataURL(4, 6));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, (size - qrSize) / 2, 14, qrSize, qrSize);
    context.fillStyle = "#172019";
    context.font = "600 18px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(
      `Wayfare · ${index + 1} / ${frames.length}`,
      size / 2,
      495,
    );
    const rgba = context.getImageData(0, 0, size, size).data;
    const palette = quantize(rgba, 16);
    gif.writeFrame(applyPalette(rgba, palette), size, size, {
      palette,
      delay: 550,
      repeat: 0,
    });
  }
  gif.finish();
  const encoded = gif.bytes();
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return new Blob([copy.buffer], { type: "image/gif" });
}

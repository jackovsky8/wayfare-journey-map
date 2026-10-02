export function buildQrShareMessage(
  configuredSiteUrl: string | undefined,
  currentHref: string,
) {
  const fallbackUrl = new URL(currentHref);
  fallbackUrl.search = "";
  fallbackUrl.hash = "";

  const appUrl = configuredSiteUrl?.trim()
    ? new URL(configuredSiteUrl, fallbackUrl)
    : fallbackUrl;
  appUrl.search = "";
  appUrl.hash = "";

  const importUrl = new URL(appUrl);
  importUrl.searchParams.set("import", "1");

  return {
    appUrl: appUrl.toString(),
    importUrl: importUrl.toString(),
    text: [
      "To receive this journey, open the import link, tap “Scan frames with this device”, allow camera access, and point the camera at the attached animated QR GIF on another screen. Keep scanning until it reaches 100%.",
      `Open Wayfare and import this journey: ${importUrl}`,
    ].join("\n\n"),
  };
}

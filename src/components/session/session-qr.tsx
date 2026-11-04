"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function SessionQr({
  url,
  alt = "Session QR code",
}: {
  url: string;
  alt?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Keep modules black on a white card. Theme foreground is light on dark
    // themes and makes the code unreadable to phones.
    QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#111111", light: "#00000000" },
    }).then((value) => {
      if (!cancelled) setDataUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) {
    return (
      <div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-[var(--surface-2)]" />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={alt}
      className="h-[220px] w-[220px] rounded-lg bg-white p-2"
    />
  );
}

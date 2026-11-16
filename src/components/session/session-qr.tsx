"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

export function SessionQr({
  url,
  alt = "Session QR code",
  downloadFileName,
}: {
  url: string;
  alt?: string;
  /** When set, the code is a shareable PNG and a download control sits under it. */
  downloadFileName?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Keep modules black on a white card. Theme foreground is light on dark
    // themes and makes the code unreadable to phones. A downloadable code
    // needs an opaque white background so it still scans after it is shared.
    QRCode.toDataURL(url, {
      margin: downloadFileName ? 2 : 1,
      width: downloadFileName ? 768 : 220,
      color: {
        dark: "#111111",
        light: downloadFileName ? "#ffffff" : "#00000000",
      },
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, downloadFileName]);

  if (!dataUrl) {
    return (
      <div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-[var(--surface-2)]" />
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={alt}
      className="h-[220px] w-[220px] rounded-lg bg-white p-2"
    />
  );

  if (!downloadFileName) return image;

  return (
    <div className="flex w-[220px] flex-col gap-2">
      {image}
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="w-full !bg-white !text-[#111111] hover:!bg-neutral-100"
      >
        <a href={dataUrl} download={downloadFileName}>
          <Download className="h-4 w-4" aria-hidden />
          Download
        </a>
      </Button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { X, Camera, RefreshCw } from "lucide-react";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectedRef = useRef(false); // guard: fire onDetected exactly once
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;
    detectedRef.current = false;

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!active) return;
        setCameras(devices);

        if (devices.length === 0) {
          setError("No camera found on this device.");
          return;
        }

        // Prefer back/environment camera on mobile
        const preferredIndex = devices.findIndex(d =>
          /back|rear|environment/i.test(d.label)
        );
        const idx = preferredIndex >= 0 ? preferredIndex : 0;
        setCameraIndex(idx);

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        setScanning(true);

        await reader.decodeFromVideoDevice(
          devices[idx].deviceId,
          videoRef.current!,
          (result, err) => {
            if (!active || detectedRef.current) return;
            if (result) {
              detectedRef.current = true;      // prevent further callbacks
              readerRef.current?.reset();       // stop camera immediately
              onDetected(result.getText());
            }
            if (err && !(err instanceof NotFoundException)) {
              console.warn("Scanner:", err);
            }
          }
        );
      } catch (e: any) {
        if (!active) return;
        if (e?.name === "NotAllowedError") {
          setError("Camera permission denied. Please allow camera access and try again.");
        } else if (e?.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Could not start camera: " + (e?.message ?? "Unknown error"));
        }
        setScanning(false);
      }
    }

    start();

    return () => {
      active = false;
      readerRef.current?.reset();
    };
  }, [cameraIndex]);

  const switchCamera = () => {
    readerRef.current?.reset();
    setCameraIndex(i => (i + 1) % cameras.length);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

        {/* Targeting reticle */}
        {scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-36">
              <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-sm" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-sm" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-sm" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-sm" />
              <div className="absolute inset-x-2 top-1/2 h-px bg-primary/70 animate-scan" />
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center">
            <Camera className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}

        {/* Close */}
        <button onClick={onClose} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors">
          <X className="h-4 w-4" />
        </button>

        {/* Switch camera */}
        {cameras.length > 1 && (
          <button onClick={switchCamera} className="absolute top-2 left-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Point your camera at a product barcode
      </p>
    </div>
  );
}

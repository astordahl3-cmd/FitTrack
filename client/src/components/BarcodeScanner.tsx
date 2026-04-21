import { useEffect, useRef, useState } from "react";
import { X, Camera, RefreshCw, Loader2 } from "lucide-react";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

// Native BarcodeDetector (Chrome 83+, Safari 17+, most modern mobile browsers)
declare const BarcodeDetector: any;

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camIndex, setCamIndex] = useState(-1); // -1 = not yet chosen

  // Start camera stream
  useEffect(() => {
    let cancelled = false;
    firedRef.current = false;

    async function startCamera() {
      try {
        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        // Get camera list on first run
        let cams = cameras;
        if (cams.length === 0) {
          // Request permission first so labels are available
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(t => t.stop());
          const devices = await navigator.mediaDevices.enumerateDevices();
          cams = devices.filter(d => d.kind === "videoinput");
          if (!cancelled) setCameras(cams);
        }

        if (cams.length === 0) {
          setError("No camera found on this device.");
          return;
        }

        // Pick back camera by default
        let idx = camIndex;
        if (idx < 0) {
          const backIdx = cams.findIndex(d => /back|rear|environment/i.test(d.label));
          idx = backIdx >= 0 ? backIdx : 0;
          if (!cancelled) setCamIndex(idx);
        }

        const deviceId = cams[idx]?.deviceId;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, facingMode: "environment" }
            : { facingMode: "environment" },
          audio: false,
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!cancelled) setReady(true);

        // Start detection loop
        startDetection();
      } catch (e: any) {
        if (cancelled) return;
        if (e?.name === "NotAllowedError") {
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else {
          setError("Could not start camera: " + (e?.message ?? String(e)));
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [camIndex]);

  function startDetection() {
    // Use native BarcodeDetector if available
    if (typeof BarcodeDetector !== "undefined") {
      detectWithNativeAPI();
    } else {
      detectWithQuagga();
    }
  }

  function detectWithNativeAPI() {
    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"],
    });

    async function tick() {
      if (firedRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0 && !firedRef.current) {
          firedRef.current = true;
          const code = barcodes[0].rawValue;
          stop();
          onDetected(code);
          return;
        }
      } catch {
        // Detection errors are normal when no barcode in frame
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function detectWithQuagga() {
    // Fallback: use Quagga2 on the video element
    const Quagga = (await import("@ericblade/quagga2")).default;

    if (!videoRef.current || firedRef.current) return;

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: videoRef.current,
          constraints: { facingMode: "environment" },
        },
        decoder: {
          readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"],
        },
        locate: true,
      },
      (err: any) => {
        if (err) {
          setError("Barcode scanner failed to initialize.");
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((result: any) => {
      if (firedRef.current) return;
      const code = result?.codeResult?.code;
      if (code) {
        firedRef.current = true;
        Quagga.stop();
        stop();
        onDetected(code);
      }
    });
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }

  const switchCamera = () => {
    if (cameras.length < 2) return;
    stop();
    setReady(false);
    setCamIndex(i => (i + 1) % cameras.length);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Loading spinner */}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        {/* Targeting reticle */}
        {ready && !error && (
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

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center">
            <Camera className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}

        {/* Close */}
        <button
          onClick={() => { stop(); onClose(); }}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Switch camera */}
        {cameras.length > 1 && (
          <button
            onClick={switchCamera}
            className="absolute top-2 left-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Point your camera at a product barcode · Hold steady for 1–2 seconds
      </p>
    </div>
  );
}

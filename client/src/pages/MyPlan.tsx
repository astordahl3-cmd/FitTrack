import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getPlanDocumentUrl, uploadPlanDocument, deletePlanDocument } from "@/lib/storage";
import { Upload, Trash2, Download, FileText, Loader2, RefreshCw } from "lucide-react";

export default function MyPlan() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const url = await getPlanDocumentUrl();
      setPdfUrl(url);
    } catch {
      setPdfUrl(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlan(); }, []);

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "PDF files only", description: "Please select a .pdf file.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 20 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPlanDocument(file);
      setPdfUrl(url);
      setIframeKey(k => k + 1);
      toast({ title: "Plan uploaded ✓" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove your current plan? You can always upload a new one.")) return;
    setDeleting(true);
    try {
      await deletePlanDocument();
      setPdfUrl(null);
      toast({ title: "Plan removed" });
    } catch (e: any) {
      toast({ title: "Could not remove plan", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">My Plan</h1>
          <p className="text-sm text-muted-foreground">Your personalized diet & exercise plan</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pdfUrl && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={pdfUrl} download="my-plan.pdf" target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1.5" /> Download
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setIframeKey(k => k + 1); loadPlan(); }}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading…</>
              : <><Upload className="h-4 w-4 mr-1.5" /> {pdfUrl ? "Replace Plan" : "Upload Plan"}</>
            }
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading your plan…</p>
          </CardContent>
        </Card>
      ) : pdfUrl ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <iframe
              key={iframeKey}
              src={pdfUrl}
              title="My Plan"
              className="w-full border-0"
              style={{ height: "75vh", minHeight: 480 }}
            />
          </CardContent>
          <div className="px-4 py-3 border-t flex items-center justify-between gap-2 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              If the PDF doesn't display on iPhone, tap <strong>Download</strong> to open it in Files.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Trash2 className="h-4 w-4 mr-1" /> Remove</>
              }
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No plan uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your diet & exercise plan PDF to keep it handy in the app.
              </p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
                : <><Upload className="h-4 w-4 mr-2" /> Upload Plan PDF</>
              }
            </Button>
            <p className="text-xs text-muted-foreground">PDF only · Max 20 MB · Stored securely per account</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Your plan is stored privately in your account and only visible to you.
            Replace it anytime by uploading a new PDF — the previous version will be overwritten.
            Tap the refresh button if the PDF stops loading (signed URLs expire after 1 hour).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

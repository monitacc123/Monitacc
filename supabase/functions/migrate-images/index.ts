import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "public" }, global: { headers: {} } }
    );

    const url = new URL(req.url);
    const recordId = url.searchParams.get("id");

    if (recordId) {
      const result = await migrateRecord(supabase, parseInt(recordId));
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List records that need migration (without loading image_url content)
    const { data, error } = await supabase.rpc("get_base64_record_ids");

    if (error) {
      // Fallback: just return IDs from a lightweight query
      const { data: ids, error: idsErr } = await supabase
        .from("records")
        .select("id")
        .like("image_url", "data:%")
        .limit(100);

      if (idsErr) {
        return new Response(JSON.stringify({ error: idsErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          message: "Records needing migration",
          count: ids?.length || 0,
          ids: (ids || []).map((r: any) => r.id),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Records needing migration",
        count: data?.length || 0,
        ids: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function migrateRecord(
  supabase: any,
  recordId: number
): Promise<{ id: number; status: string; url?: string }> {
  try {
    const { data: record, error } = await supabase
      .from("records")
      .select("id, user_id, image_url")
      .eq("id", recordId)
      .maybeSingle();

    if (error) return { id: recordId, status: `fetch_error: ${error.message}` };
    if (!record) return { id: recordId, status: "not_found" };
    if (!record.image_url || !record.image_url.startsWith("data:")) {
      return { id: recordId, status: "already_migrated" };
    }

    const dataUrl: string = record.image_url;
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return { id: recordId, status: "invalid_data_url" };

    const meta = dataUrl.substring(0, commaIdx);
    const base64 = dataUrl.substring(commaIdx + 1);

    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1] || "jpg";

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });

    const timestamp = Date.now();
    const path = `${record.user_id}/migrated_${record.id}_${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, blob, { upsert: true });

    if (uploadError) {
      return { id: recordId, status: `upload_error: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("records")
      .update({ image_url: urlData.publicUrl })
      .eq("id", recordId);

    if (updateError) {
      return { id: recordId, status: `update_error: ${updateError.message}` };
    }

    return { id: recordId, status: "migrated", url: urlData.publicUrl };
  } catch (e: any) {
    return { id: recordId, status: `error: ${e.message}` };
  }
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminEmail = "admin@monitacc.com";
    const adminPassword = "Admin@Monitacc2026";

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const alreadyExists = existing?.users?.find((u: any) => u.email === adminEmail);

    let userId: string;

    if (alreadyExists) {
      await supabaseAdmin.auth.admin.updateUserById(alreadyExists.id, { password: adminPassword });
      userId = alreadyExists.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { name: "Admin Monitacc" },
      });
      if (createError) throw createError;
      userId = newUser.user.id;
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: insertError } = await supabaseAdmin.from("users").insert({
        id: userId,
        name: "Admin Monitacc",
        email: adminEmail,
        phone: "",
        company_name: "Monitacc HQ",
        role: "admin",
        plan: "Ultimate",
        status: "active",
      });
      if (insertError) throw insertError;
    } else {
      await supabaseAdmin.from("users").update({ role: "admin", status: "active" }).eq("id", userId);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Admin account ready", email: adminEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

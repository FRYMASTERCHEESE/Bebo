import { createClient } from "npm:@supabase/supabase-js@2.57.0";

// Dedicated Bebo account erasure endpoint. No private keys are exposed in the browser.
// Deploy with JWT verification ON, and use this only for an existing verified account.
const siteOrigin = "https://frymastercheese.github.io";
const cors = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function response(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function tokenIssuedRecently(jwt: string): boolean {
  try {
    const body = jwt.split(".")[1];
    if (!body) return false;
    const padded = body.replace(/-/g, "+").replace(/_/g, "/");
    const claim = JSON.parse(atob(padded + "=".repeat((4 - padded.length % 4) % 4)));
    const age = Date.now() / 1000 - Number(claim.iat);
    // The UI obtains a fresh JWT by validating the current password first.
    return Number.isFinite(age) && age >= -60 && age <= 300;
  } catch {
    return false;
  }
}
async function purgeFolder(admin: ReturnType<typeof createClient>, bucket: string, uid: string) {
  let total = 0;
  // All files uploaded by Bebo are stored directly under the member UUID folder.
  while (total <= 2000) {
    const { data: files, error } = await admin.storage.from(bucket).list(uid, { limit: 100, offset: 0 });
    if (error) throw new Error("Failed to list stored images in " + bucket);
    if (!files?.length) return;
    const paths = files.filter(f => !!f.name && !!f.id).map(f => uid + "/" + f.name);
    if (!paths.length) throw new Error("Unexpected folder structure in " + bucket);
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) throw new Error("Failed to delete images in " + bucket);
    total += paths.length;
  }
  throw new Error("Too many stored files; administrator assistance is required");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== siteOrigin) return response({ error: "Origin not allowed" }, 403);
  if (Number(req.headers.get("content-length") || 0) > 1024) return response({ error: "Request too large" }, 413);
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response({ error: "Authentication required" }, 401);
  const jwt = authorization.slice(7);
  if (!tokenIssuedRecently(jwt)) return response({ error: "Sign in again to confirm account deletion" }, 401);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRole) return response({ error: "Account deletion is temporarily unavailable" }, 503);
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const body = JSON.parse((await req.text()).slice(0,1025));
    if (body?.confirmation !== "DELETE MY BEBO ACCOUNT") return response({ error: "Confirmation phrase is required" }, 400);
    const { data: { user }, error: verifyError } = await admin.auth.getUser(jwt);
    if (verifyError || !user) return response({ error: "Authentication failed" }, 401);
    await purgeFolder(admin,"bebo-avatars",user.id);
    await purgeFolder(admin,"bebo-skin-banners",user.id);
    await purgeFolder(admin,"bebo-photos",user.id);
    await purgeFolder(admin,"bebo-videos",user.id);
    // Foreign keys cascade Bebo social content. This is permanent deletion, not a soft delete.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error("Account deletion was not completed");
    return response({ deleted: true });
  } catch (err) {
    // Never send privileged error details to unauthenticated or ordinary clients.
    console.error("bebo-delete-account request failed", err instanceof Error ? err.message : "unknown error");
    return response({ error: "Could not complete account deletion. Please contact the site administrator." }, 500);
  }
});

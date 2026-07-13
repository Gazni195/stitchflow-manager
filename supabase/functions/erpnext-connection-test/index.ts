const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get("ERPNEXT_URL");
  const key = Deno.env.get("ERPNEXT_API_KEY");
  const secret = Deno.env.get("ERPNEXT_API_SECRET");

  if (!url || !key || !secret) {
    return json({
      success: false,
      erpnext_http_status: null,
      authenticated: false,
      authenticated_user: null,
      error: "Missing ERPNext configuration",
    }, 500);
  }

  const base = url.replace(/\/+$/, "");
  const endpoint = `${base}/api/method/frappe.auth.get_logged_user`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `token ${key}:${secret}`,
        Accept: "application/json",
      },
    });

    const status = res.status;
    let user: string | null = null;
    let parseErr: string | null = null;

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (typeof data?.message === "string") user = data.message;
    } catch {
      parseErr = "Non-JSON response from ERPNext";
    }

    const authenticated = res.ok && !!user;

    return json({
      success: authenticated,
      erpnext_http_status: status,
      authenticated,
      authenticated_user: user,
      error: authenticated ? null : (parseErr ?? `ERPNext returned HTTP ${status}`),
    });
  } catch (e) {
    return json({
      success: false,
      erpnext_http_status: null,
      authenticated: false,
      authenticated_user: null,
      error: `Request failed: ${(e as Error).message}`,
    }, 502);
  }
});

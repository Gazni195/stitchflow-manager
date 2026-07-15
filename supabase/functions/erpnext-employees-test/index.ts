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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("ERPNEXT_URL");
  const key = Deno.env.get("ERPNEXT_API_KEY");
  const secret = Deno.env.get("ERPNEXT_API_SECRET");

  if (!url || !key || !secret) {
    return json({ success: false, employees: [], error: "Missing ERPNext configuration" }, 500);
  }

  const base = url.replace(/\/+$/, "");
  const filters = encodeURIComponent(JSON.stringify([["status", "=", "Active"]]));
  const fields = encodeURIComponent(JSON.stringify(["employee", "employee_name", "status"]));
  const endpoint = `${base}/api/resource/Employee?filters=${filters}&fields=${fields}&limit_page_length=0&limit_start=0`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { Authorization: `token ${key}:${secret}`, Accept: "application/json" },
    });
    const status = res.status;
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const errMsg = parsed?.exception || parsed?.message || parsed?._server_messages || text.slice(0, 500);
      return json({
        success: false,
        erpnext_http_status: status,
        access_succeeded: false,
        employees: [],
        error: errMsg,
      });
    }

    const records: Array<{ employee: string; employee_name: string; status: string }> = Array.isArray(parsed?.data)
      ? parsed.data
      : [];

    return json({
      success: true,
      erpnext_http_status: status,
      access_succeeded: true,
      total_employees: records.length,
      employees: records.map((r) => ({
        employee: r.employee,
        employee_name: r.employee_name,
        status: r.status,
      })),
    });
  } catch (e) {
    return json(
      {
        success: false,
        erpnext_http_status: null,
        access_succeeded: false,
        employees: [],
        error: `Request failed: ${(e as Error).message}`,
      },
      502,
    );
  }
});

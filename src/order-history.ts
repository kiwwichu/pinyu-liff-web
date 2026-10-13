import { getVerifiedLineUserId } from "./line";
import { createSupabaseAdmin } from "./supabase";

type HistoryRequest = {
  accessToken: string;
};

type OrderRow = {
  order_id: string;
  legacy_order_id: string;
  order_status: string;
  confirmation_result: string | null;
  established_at: string | null;
  service_date_raw: string | null;
  service_type: string | null;
  plan_name: string | null;
  hours: number | null;
  quantity: number | null;
  standard_price: number | null;
  custom_price: number | null;
  travel_fee: number | null;
  standard_deposit: number | null;
  custom_deposit: number | null;
  remaining_payment: number | null;
  total: number | null;
  unpaid_balance: number | null;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseRequest(value: unknown): HistoryRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const accessToken = Reflect.get(value, "accessToken");
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  return { accessToken: accessToken.trim() };
}

function money(value: number | null): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function cardColor(status: string, confirmationResult: string | null): string {
  if (status.includes("未付訂金")) return "#e53935";
  if (status.includes("待執行") || (status.includes("常客") && confirmationResult === "已確認")) {
    return "#48a2e8";
  }
  if (status.includes("待付尾款") || status.includes("未付尾款")) return "#fcd687";
  if (status.includes("完成")) return "#19a463";
  return "#999999";
}

function paymentText(rows: OrderRow[]): { depositText: string; tailText: string } {
  const first = rows[0];
  const status = first.order_status.replace(/\s+/g, "");
  const deposit = rows.reduce(
    (sum, row) => sum + Math.max(money(row.custom_deposit), money(row.standard_deposit)),
    0,
  );
  const unpaidTail = rows.reduce(
    (sum, row) => sum + Math.max(money(row.unpaid_balance), money(row.remaining_payment)),
    0,
  );

  if (status.includes("常客")) {
    return { depositText: "訂金：免訂金（常客）", tailText: "" };
  }
  if (status.includes("完成")) {
    return { depositText: "訂金：已付 ✅", tailText: "尾款：已付 ✅" };
  }
  if (status.includes("未付尾款") || status.includes("待付尾款")) {
    return {
      depositText: "訂金：已付 ✅",
      tailText: `尾款未付：${unpaidTail} 元`,
    };
  }
  if (status.includes("未付訂金")) {
    return { depositText: `訂金未付：${deposit} 元`, tailText: "" };
  }
  if (status.includes("待執行")) {
    return { depositText: "訂金：已付 ✅", tailText: "" };
  }
  return { depositText: "", tailText: "" };
}

function buildHistory(rows: OrderRow[]) {
  const grouped = new Map<string, OrderRow[]>();
  for (const row of rows) {
    const key = row.legacy_order_id || row.order_id;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }

  return Array.from(grouped, ([orderId, group]) => {
    const first = group[0];
    const services = Array.from(
      new Set(group.map((row) => row.service_type).filter((value): value is string => Boolean(value))),
    );
    const total = group.reduce((sum, row) => sum + money(row.total), 0);
    const payment = paymentText(group);
    // Internal order notes are intentionally not returned to customers. Only
    // explicit customer-facing fields should be added here in the future.
    const depositText = [payment.depositText, payment.tailText]
      .filter(Boolean)
      .join("｜");

    return {
      orderId,
      serviceDate: first.service_date_raw ?? "",
      serviceText: services.join("、"),
      total,
      status: first.order_status.includes("未付訂金")
        ? "未付訂金（訂單未成立）"
        : first.order_status,
      depositText,
      tailText: payment.tailText,
      cardColor: cardColor(first.order_status, first.confirmation_result),
      items: group.map((row, index) => {
        const quantity = row.quantity ?? 0;
        const travelUnit = money(row.travel_fee);
        return {
          index: index + 1,
          category: row.service_type ?? row.plan_name ?? "",
          dateText: row.service_date_raw ?? "",
          hours: row.hours ?? "",
          times: quantity,
          unitPrice: money(row.custom_price) || money(row.standard_price),
          travelUnit,
          travelTotal: travelUnit * quantity,
          lineTotal: money(row.total),
        };
      }),
    };
  }).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
}

export async function handleOrderHistory(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 16 * 1024) {
    return json({ success: false, message: "Request body too large" }, 413);
  }

  let input: HistoryRequest | null = null;
  try {
    input = parseRequest(await request.json());
  } catch {
    return json({ success: false, message: "Invalid JSON body" }, 400);
  }
  if (!input) return json({ success: false, message: "LINE_ACCESS_TOKEN_REQUIRED" }, 400);

  const lineUserId = await getVerifiedLineUserId(
    input.accessToken,
    env.LINE_LIFF_CHANNEL_ID,
  );
  if (!lineUserId) return json({ success: false, message: "LINE_AUTH_FAILED" }, 401);

  const supabase = createSupabaseAdmin(env);
  const { data: binding, error: bindingError } = await supabase
    .from("line_bindings")
    .select("family_id")
    .eq("line_user_id", lineUserId)
    .eq("binding_status", "bound")
    .eq("is_enabled", true)
    .maybeSingle();

  if (bindingError) throw bindingError;
  if (!binding) return json({ success: false, message: "NOT_BOUND" });

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id,legacy_order_id,order_status,confirmation_result,established_at,service_date_raw,service_type,plan_name,hours,quantity,standard_price,custom_price,travel_fee,standard_deposit,custom_deposit,remaining_payment,total,unpaid_balance",
    )
    .eq("family_id", binding.family_id)
    .order("established_at", { ascending: false });

  if (error) throw error;
  return json({ success: true, orders: buildHistory(data ?? []) });
}

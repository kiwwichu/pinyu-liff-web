import { createSupabaseAdmin } from "./supabase";

const JSON_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

function safePublicName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 30);
  if (!name) return null;
  // Even an explicitly public field is rejected if it resembles contact data.
  if (/@|https?:\/\/|line\s*id|[0-9０-９][0-9０-９\s-]{6,}/i.test(name)) return null;
  return name;
}

function safePetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 20);
  if (!name || /@|https?:\/\/|[0-9０-９][0-9０-９\s-]{6,}/i.test(name)) return null;
  return name;
}

function safeFeedback(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const feedback = value.trim().replace(/\r\n?/g, "\n").slice(0, 1200);
  return feedback || null;
}

function ratingTag(label: string, value: number | null): string | null {
  return typeof value === "number" && value >= 4 ? label : null;
}

function sourceFromLegacyData(value: unknown): { label: string; url: string | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { label: "Pinyu 服務後評價", url: null };
  }
  const source = String((value as Record<string, unknown>).review_source ?? "").toLowerCase();
  if (source === "maoxiaoai") return { label: "毛小愛公開評價", url: null };
  if (source === "private_message") return { label: "飼主私訊回饋", url: null };
  return { label: "Pinyu 服務後評價", url: null };
}

export async function handlePublicReviews(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return json({ success: false, message: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });
  }

  const supabase = createSupabaseAdmin(env);
  const { data: reviews, error: reviewsError } = await supabase
    .from("service_reviews")
    .select("review_id,legacy_order_id,family_id,overall_rating,report_clarity,care_quality,pet_comfort,punctuality,communication,feedback,public_name,submitted_at,legacy_data")
    .eq("allow_anonymous_publication", true)
    .not("feedback", "is", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(12);

  if (reviewsError) throw reviewsError;

  const usableReviews = (reviews ?? []).filter(review => safeFeedback(review.feedback));
  const legacyOrderIds = [...new Set(usableReviews.map(review => review.legacy_order_id).filter(Boolean))];
  const familyIds = [...new Set(usableReviews.map(review => review.family_id).filter(Boolean))];

  const [ordersResult, petsResult] = await Promise.all([
    legacyOrderIds.length
      ? supabase.from("orders").select("legacy_order_id,pet_name_snapshot").in("legacy_order_id", legacyOrderIds)
      : Promise.resolve({ data: [], error: null }),
    familyIds.length
      ? supabase.from("pets").select("family_id,pet_name").in("family_id", familyIds).eq("is_enabled", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (petsResult.error) throw petsResult.error;

  const orderPets = new Map<string, string>();
  for (const order of ordersResult.data ?? []) {
    const petName = safePetName(order.pet_name_snapshot);
    if (petName && !orderPets.has(order.legacy_order_id)) orderPets.set(order.legacy_order_id, petName);
  }

  const familyPets = new Map<string, string>();
  for (const pet of petsResult.data ?? []) {
    const petName = safePetName(pet.pet_name);
    if (petName && !familyPets.has(pet.family_id)) familyPets.set(pet.family_id, petName);
  }

  const publicReviews = usableReviews.map(review => {
    const petName = orderPets.get(review.legacy_order_id) ?? familyPets.get(review.family_id) ?? null;
    const displayName = safePublicName(review.public_name) ?? (petName ? `${petName}家長` : "毛孩家長");
    const tags = [
      ratingTag("回報清楚", review.report_clarity),
      ratingTag("照顧細心", review.care_quality),
      ratingTag("尊重毛孩步調", review.pet_comfort),
      ratingTag("準時", review.punctuality),
      ratingTag("溝通安心", review.communication),
    ].filter((tag): tag is string => Boolean(tag)).slice(0, 2);
    if (tags.length === 0 && review.overall_rating === 5) tags.push("五星回饋");
    const source = sourceFromLegacyData(review.legacy_data);

    return {
      id: review.review_id,
      displayName,
      petName,
      rating: Math.max(1, Math.min(5, review.overall_rating)),
      title: tags[0] === "回報清楚"
        ? "人在外面，也能清楚知道毛孩的狀況"
        : tags[0] === "尊重毛孩步調"
          ? "照著毛孩的步調，慢慢建立信任"
          : "這次服務後，飼主想說的話",
      text: safeFeedback(review.feedback),
      tags,
      sourceLabel: source.label,
      sourceUrl: source.url,
      photoUrl: null,
    };
  });

  return json({ success: true, reviews: publicReviews });
}

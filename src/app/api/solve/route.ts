import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isAcceptedImageType, MAX_FILE_SIZE } from "@/lib/validation";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-20250514";
const SYSTEM_PROMPT =
  "Та тэвчээртэй математикийн багш. Зураг дээрх бодлогыг уншаад, бодлогын хэлээс үл хамааран зөвхөн Монгол кирилл хэлээр хариул. 1) Бодлогыг өөрийн үгээр дахин бич, 2) алхам бүрийг товч тайлбарлан бод, 3) эцсийн хариуг тодорхой тэмдэглэ, 4) хариуг шалга. Томьёог $...$ болон $$...$$ LaTeX хэлбэрээр бич. Тэгшитгэл, функц, уламжлал, интеграл, гурвалжин зэрэг Монгол математикийн нэр томьёо хэрэглэ. Зураг тодорхойгүй бол таамаглахгүйгээр юу нь уншигдахгүй байгааг хэл.";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("problemId" in body)) {
      return NextResponse.json({ error: "Бодлогын дугаар шаардлагатай." }, { status: 400 });
    }
    const { problemId, force } = body as { problemId?: unknown; force?: unknown };
    if (typeof problemId !== "string" || !/^[0-9a-f-]{36}$/i.test(problemId)) {
      return NextResponse.json({ error: "Бодлогын дугаар буруу байна." }, { status: 400 });
    }
    if (force !== undefined && typeof force !== "boolean") {
      return NextResponse.json({ error: "Дахин бодох тохиргоо буруу байна." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Бодлого бодохын тулд нэвтэрнэ үү." }, { status: 401 });
    }

    const rate = checkRateLimit(`solve:${userData.user.id}`, 5, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Хэт олон бодлого бодох хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const { data: problem, error: problemError } = await supabase
      .from("problems")
      .select("id, image_path")
      .eq("id", problemId)
      .single();
    if (problemError || !problem) {
      return NextResponse.json({ error: "Бодлого олдсонгүй." }, { status: 404 });
    }

    if (!force) {
      const { data: savedSolution, error: solutionError } = await supabase
        .from("solutions")
        .select("content, model, created_at")
        .eq("problem_id", problemId)
        .maybeSingle();
      if (solutionError) {
        return NextResponse.json({ error: "Хадгалсан бодолтыг ачаалж чадсангүй." }, { status: 500 });
      }
      if (savedSolution) return NextResponse.json({ solution: savedSolution, cached: true });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI үйлчилгээг серверт тохируулаагүй байна." }, { status: 503 });
    }

    const { data: file, error: fileError } = await supabase.storage
      .from("problems")
      .download(problem.image_path);
    if (fileError || !file) {
      return NextResponse.json({ error: "Бодлогын зургийг нээж чадсангүй." }, { status: 404 });
    }
    if (file.size > MAX_FILE_SIZE || !isAcceptedImageType(file.type)) {
      return NextResponse.json({ error: "Хадгалсан зураг дэмжигдэхгүй төрөлтэй эсвэл 10 МБ-аас их байна." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mediaType = file.type as "image/jpeg" | "image/png";
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") },
            },
            { type: "text", text: "Зурагт байгаа математикийн бодлогыг бодож тайлбарлана уу." },
          ],
        },
      ],
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    if (!content.trim()) {
      return NextResponse.json({ error: "AI хоосон бодолт буцаалаа. Дахин оролдоно уу." }, { status: 502 });
    }

    const { data: saved, error: saveError } = await supabase
      .from("solutions")
      .upsert(
        { problem_id: problemId, content, model: MODEL, created_at: new Date().toISOString() },
        { onConflict: "problem_id" },
      )
      .select("content, model, created_at")
      .single();
    if (saveError || !saved) {
      return NextResponse.json({ error: "Бодолт гарсан боловч хадгалж чадсангүй." }, { status: 500 });
    }

    return NextResponse.json({ solution: saved, cached: false });
  } catch (error) {
    console.error("Solve request failed:", error);
    return NextResponse.json({ error: "Бодлого бодох үед алдаа гарлаа. Дахин оролдоно уу." }, { status: 500 });
  }
}

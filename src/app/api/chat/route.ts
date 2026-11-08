import { ApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isAcceptedImageType, MAX_FILE_SIZE } from "@/lib/validation";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "Та тэвчээртэй математикийн багш. Зураг дээрх бодлогыг уншаад, бодлогын хэлээс үл хамааран зөвхөн Монгол кирилл хэлээр хариул. 1) Бодлогыг өөрийн үгээр дахин бич, 2) алхам бүрийг товч тайлбарлан бод, 3) эцсийн хариуг тодорхой тэмдэглэ, 4) хариуг шалга. Томьёог $...$ болон $$...$$ LaTeX хэлбэрээр бич. Тэгшитгэл, функц, уламжлал, интеграл, гурвалжин зэрэг Монгол математикийн нэр томьёо хэрэглэ. Зураг тодорхойгүй бол таамаглахгүйгээр юу нь уншигдахгүй байгааг хэл.";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Асуулт шаардлагатай." }, { status: 400 });
    }
    const { problemId, question } = body as { problemId?: unknown; question?: unknown };
    if (typeof problemId !== "string" || !/^[0-9a-f-]{36}$/i.test(problemId)) {
      return NextResponse.json({ error: "Бодлогын дугаар буруу байна." }, { status: 400 });
    }
    if (typeof question !== "string" || question.trim().length < 1 || question.length > 1000) {
      return NextResponse.json({ error: "Асуулт 1-ээс 1000 тэмдэгтийн хооронд байна." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Нэмэлт асуулт асуухын тулд нэвтэрнэ үү." }, { status: 401 });
    }
    const rate = checkRateLimit(`chat:${userData.user.id}`, 20, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Хэт олон нэмэлт асуулт илгээлээ. Түр хүлээгээд дахин оролдоно уу." },
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
    const { data: solution, error: solutionError } = await supabase
      .from("solutions")
      .select("content")
      .eq("problem_id", problemId)
      .single();
    if (solutionError || !solution) {
      return NextResponse.json({ error: "Нэмэлт асуулт асуухаас өмнө бодлогыг бодно уу." }, { status: 409 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL;
    if (!apiKey || !model) {
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

    const gemini = new GoogleGenAI({ apiKey });
    const response = await gemini.models.generateContent({
      model,
      config: {
        maxOutputTokens: 1500,
        systemInstruction: SYSTEM_PROMPT,
      },
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: file.type as "image/jpeg" | "image/png",
              data: Buffer.from(await file.arrayBuffer()).toString("base64"),
            },
          },
          { text: `Өмнөх бодолт:\n${solution.content}\n\nСурагчийн асуулт: ${question.trim()}` },
        ],
      }],
    });
    const answer = response.text ?? "";
    if (!answer.trim()) {
      return NextResponse.json({ error: "AI хоосон хариу буцаалаа. Дахин оролдоно уу." }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Follow-up request failed:", message);
    if (
      (error instanceof ApiError && error.status === 429)
      || /\b429\b|quota|resource_exhausted|rate.?limit/i.test(message)
    ) {
      return NextResponse.json(
        { error: "Үнэгүй хязгаар түр дууслаа. Түр хүлээгээд дахин оролдоно уу." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Асуултад хариулах үед алдаа гарлаа. Дахин оролдоно уу." }, { status: 500 });
  }
}

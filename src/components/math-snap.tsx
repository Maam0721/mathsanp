"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";
import { InlineMath } from "react-katex";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudUpload,
  FileImage,
  FileText,
  FolderPlus,
  GraduationCap,
  ImagePlus,
  Languages,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_LANGUAGE,
  getAuthErrorMessage,
  getTranslations,
  type Dictionary,
  type Language,
} from "@/lib/i18n";
import { MAX_FILE_SIZE, isAcceptedImageType } from "@/lib/validation";

type Topic = { id: string; name: string; created_at: string };
type Problem = {
  id: string;
  topic_id: string;
  title: string;
  image_path: string;
  created_at: string;
};
type Solution = { content: string; model: string; created_at: string };
type Notice = { type: "error" | "success"; text: string };

function useSupabase() {
  return useMemo(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
    return createClient();
  }, []);
}

function MarkdownMath({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children: content }) => <p className="solution-paragraph">{content}</p>,
        h1: ({ children: content }) => <h3 className="solution-heading">{content}</h3>,
        h2: ({ children: content }) => <h3 className="solution-heading">{content}</h3>,
        h3: ({ children: content }) => <h4 className="solution-subheading">{content}</h4>,
        strong: ({ children: content }) => <strong className="solution-strong">{content}</strong>,
        li: ({ children: content }) => <li className="solution-list-item">{content}</li>,
        code: ({ children: content }) => <code className="solution-code">{content}</code>,
        table: ({ children: content }) => <div className="solution-table-wrap"><table>{content}</table></div>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function AuthScreen({ language, supabase }: { language: Language; supabase: NonNullable<ReturnType<typeof useSupabase>> }) {
  const t = getTranslations(language);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(getAuthErrorMessage(result.error, language));
      return;
    }
    if (signup && !result.data.session) setMessage(t.confirmEmail);
  }

  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <div className="auth-card">
        <BrandMark />
        <div className="auth-kicker"><Sparkles size={14} /> {t.authKicker}</div>
        <h1>{signup ? t.signup : t.login}</h1>
        <p className="auth-hint">{t.loginHint}</p>
        <form onSubmit={submit} className="auth-form">
          <label>{t.email}<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t.emailPlaceholder} /></label>
          <label>{t.password}<input required minLength={6} type="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t.passwordPlaceholder} /></label>
          {message && <div className={message === t.confirmEmail ? "auth-message" : "auth-message auth-message-error"}>{message}</div>}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {signup ? t.signupButton : t.loginButton}<ChevronRight size={17} />
          </button>
        </form>
        <button className="auth-switch" onClick={() => { setSignup(!signup); setMessage(""); }}>
          {signup ? t.switchLogin : t.switchSignup}
        </button>
      </div>
      <span className="auth-footer">{t.authFooter}</span>
    </main>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-icon"><span /><span /><span /><span /></span>
      <span className="brand-name">math<span>snap</span></span>
    </div>
  );
}

export function MathSnap() {
  const supabase = useSupabase();
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [darkMode, setDarkMode] = useState(false);
  const t = getTranslations(language);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("mathsnap-language");
    // Keep saved preferences out of the initial render to avoid server/client hydration mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedLanguage === "mn" || storedLanguage === "en") setLanguage(storedLanguage);
    setDarkMode(window.localStorage.getItem("mathsnap-theme") === "dark");
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Could not load the current user:", error.message);
      setSessionUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    window.localStorage.setItem("mathsnap-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("mathsnap-language", next);
  }

  if (!supabase) {
    return (
      <main className="config-page">
        <div className="config-card"><BrandMark /><div className="config-icon"><Settings2 size={26} /></div><h1>{t.configMissing}</h1><p>{t.configHelp}</p></div>
      </main>
    );
  }
  if (authLoading) return <div className="loading-screen"><BrandMark /><LoaderCircle className="spin" size={20} /><span>{t.loading}</span></div>;
  if (!sessionUser) return <AuthScreen language={language} supabase={supabase} />;
  return (
    <Dashboard
      key={sessionUser.id}
      user={sessionUser}
      language={language}
      darkMode={darkMode}
      supabase={supabase}
      onLanguage={changeLanguage}
      onTheme={() => setDarkMode((current) => !current)}
    />
  );
}

function Dashboard({
  user, language, darkMode, supabase, onLanguage, onTheme,
}: {
  user: { id: string; email?: string };
  language: Language;
  darkMode: boolean;
  supabase: NonNullable<ReturnType<typeof useSupabase>>;
  onLanguage: (language: Language) => void;
  onTheme: () => void;
}) {
  const t = getTranslations(language);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [signedImage, setSignedImage] = useState<string | null>(null);
  const [savedSolution, setSavedSolution] = useState<Solution | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "solved" | "unsolved">("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "title">("recent");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicName, setTopicName] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTopic, setUploadTopic] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [solving, setSolving] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [solveHint, setSolveHint] = useState("");
  const [chat, setChat] = useState<{ question: string; answer: string }[]>([]);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [topicMenu, setTopicMenu] = useState<string | null>(null);
  const [problemMenu, setProblemMenu] = useState(false);
  const [moving, setMoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const [topicResult, problemResult, solutionResult] = await Promise.all([
      supabase.from("topics").select("id, name, created_at").order("created_at", { ascending: true }),
      supabase.from("problems").select("id, topic_id, title, image_path, created_at").order("created_at", { ascending: false }),
      supabase.from("solutions").select("problem_id"),
    ]);
    const error = topicResult.error || problemResult.error || solutionResult.error;
    if (error) {
      console.error("Could not load library:", error.message);
      setNotice({ type: "error", text: t.actionFailed });
      setLoading(false);
      return;
    }
    const nextTopics = (topicResult.data ?? []) as Topic[];
    const nextProblems = (problemResult.data ?? []) as Problem[];
    setTopics(nextTopics);
    setProblems(nextProblems);
    setSolvedIds(new Set((solutionResult.data ?? []).map((solution) => solution.problem_id)));
    setSelectedTopic((current) => current && nextTopics.some((topic) => topic.id === current) ? current : null);
    setLoading(false);
  }, [supabase, t.actionFailed]);

  useEffect(() => {
    async function loadLibrary() {
      await refresh();
    }
    void loadLibrary();
  }, [refresh]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const currentTopic = topics.find((topic) => topic.id === selectedTopic);
  const topicProblems = problems.filter((problem) => !selectedTopic || problem.topic_id === selectedTopic);
  const filteredProblems = useMemo(() => {
    const filtered = topicProblems.filter((problem) => {
      const matchesSearch = `${problem.title} ${topics.find((topic) => topic.id === problem.topic_id)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || (filter === "solved" ? solvedIds.has(problem.id) : !solvedIds.has(problem.id));
      return matchesSearch && matchesFilter;
    });
    return filtered.sort((a, b) => sort === "oldest"
      ? a.created_at.localeCompare(b.created_at)
      : sort === "title"
        ? a.title.localeCompare(b.title)
        : b.created_at.localeCompare(a.created_at));
  }, [topicProblems, topics, search, filter, solvedIds, sort]);
  const solvedCount = problems.filter((problem) => solvedIds.has(problem.id)).length;

  function openCreateTopic() {
    setEditingTopic(null);
    setTopicName("");
    setShowTopicDialog(true);
  }

  function openEditTopic(topic: Topic) {
    setEditingTopic(topic);
    setTopicName(topic.name);
    setTopicMenu(null);
    setShowTopicDialog(true);
  }

  async function saveTopic(event: FormEvent) {
    event.preventDefault();
    const name = topicName.trim();
    if (!name || name.length > 60) return;
    const result = editingTopic
      ? await supabase.from("topics").update({ name }).eq("id", editingTopic.id)
      : await supabase.from("topics").insert({ user_id: user.id, name });
    if (result.error) {
      console.error("Could not save topic:", result.error.message);
      setNotice({ type: "error", text: t.actionFailed });
      return;
    }
    setShowTopicDialog(false);
    setNotice({ type: "success", text: editingTopic ? t.save : t.create });
    await refresh();
  }

  async function removeTopic(topic: Topic) {
    setTopicMenu(null);
    if (!window.confirm(`${t.deleteTopic}\n${t.deleteTopicBody}`)) return;
    const { data: associated, error: listError } = await supabase.from("problems").select("image_path").eq("topic_id", topic.id);
    if (listError) {
      console.error("Could not load topic problems:", listError.message);
      setNotice({ type: "error", text: t.actionFailed });
      return;
    }
    const paths = (associated ?? []).map((problem) => problem.image_path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("problems").remove(paths);
      if (storageError) {
        console.error("Could not delete topic images:", storageError.message);
        setNotice({ type: "error", text: t.actionFailed });
        return;
      }
    }
    const { error } = await supabase.from("topics").delete().eq("id", topic.id);
    if (error) {
      console.error("Could not delete topic:", error.message);
      setNotice({ type: "error", text: t.actionFailed });
      return;
    }
    if (selectedTopic === topic.id) setSelectedTopic(null);
    await refresh();
  }

  function openUpload() {
    setFiles([]);
    setUploadProgress(0);
    setUploadTopic(selectedTopic ?? topics[0]?.id ?? "");
    setShowUpload(true);
  }

  function chooseFiles(incoming: FileList | File[]) {
    const nextFiles = Array.from(incoming);
    const invalid = nextFiles.find((file) => !isAcceptedImageType(file.type) && file.type !== "application/pdf");
    if (invalid) {
      setNotice({ type: "error", text: t.invalidFileType.replace("{name}", invalid.name) });
      return;
    }
    const tooLarge = nextFiles.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setNotice({ type: "error", text: t.fileTooLarge.replace("{name}", tooLarge.name) });
      return;
    }
    setFiles((current) => [...current, ...nextFiles]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFiles(event.dataTransfer.files);
  }

  async function renderPdfPages(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: File[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.65 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error(t.pdfCanvasError);
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error(t.pdfConvertError)), "image/png"),
      );
      if (blob.size > MAX_FILE_SIZE) {
        throw new Error(t.pdfPageTooLarge.replace("{page}", String(pageNumber)).replace("{name}", file.name));
      }
      pages.push(new File([blob], `${file.name.replace(/\.pdf$/i, "")}-page-${pageNumber}.png`, { type: "image/png" }));
      canvas.width = 0;
      canvas.height = 0;
    }
    return pages;
  }

  async function uploadFiles(event: FormEvent) {
    event.preventDefault();
    if (!uploadTopic || !files.length) return;
    setUploading(true);
    setUploadProgress(0);
    let finished = 0;
    let uploaded = 0;
    try {
      const imageFiles: File[] = [];
      for (const file of files) {
        const pages = file.type === "application/pdf" ? await renderPdfPages(file) : [file];
        imageFiles.push(...pages);
        finished += 1;
        setUploadProgress(Math.round((finished / (files.length + imageFiles.length)) * 30));
      }
      if (!imageFiles.length) throw new Error(t.pdfNoPages);
      for (let index = 0; index < imageFiles.length; index += 1) {
        const file = imageFiles[index];
        if (file.size > MAX_FILE_SIZE || !isAcceptedImageType(file.type)) {
          throw new Error(t.imageOnlyError.replace("{name}", file.name));
        }
        const path = `${user.id}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
        const { error: storageError } = await supabase.storage.from("problems").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (storageError) throw storageError;
        const title = file.name.replace(/\.(png|jpe?g)$/i, "").slice(0, 120) || t.untitled;
        const { error: insertError } = await supabase.from("problems").insert({
          user_id: user.id,
          topic_id: uploadTopic,
          title,
          image_path: path,
        });
        if (insertError) {
          const { error: cleanupError } = await supabase.storage.from("problems").remove([path]);
          if (cleanupError) console.error("Could not clean up an orphaned upload:", cleanupError.message);
          throw insertError;
        }
        uploaded += 1;
        setUploadProgress(Math.round(30 + ((index + 1) / imageFiles.length) * 70));
      }
      setShowUpload(false);
      setFiles([]);
      setSelectedTopic(uploadTopic);
      setNotice({ type: "success", text: uploaded === 1 ? t.uploadSuccessOne : t.uploadSuccess.replace("{count}", String(uploaded)) });
      await refresh();
    } catch (error) {
      console.error("Problem upload failed:", error);
      setNotice({ type: "error", text: t.uploadError });
    } finally {
      setUploading(false);
    }
  }

  async function openProblem(problem: Problem) {
    const requestId = ++detailRequestRef.current;
    setSelectedProblem(problem);
    setSignedImage(null);
    setSavedSolution(null);
    setChat([]);
    setQuestion("");
    setSolveHint("");
    const [imageResult, solutionResult] = await Promise.all([
      supabase.storage.from("problems").createSignedUrl(problem.image_path, 60 * 60),
      supabase.from("solutions").select("content, model, created_at").eq("problem_id", problem.id).maybeSingle(),
    ]);
    if (requestId !== detailRequestRef.current) return;
    if (imageResult.error) {
      console.error("Could not create problem image URL:", imageResult.error.message);
      setNotice({ type: "error", text: t.actionFailed });
    }
    else setSignedImage(imageResult.data.signedUrl);
    if (solutionResult.error) {
      console.error("Could not load saved solution:", solutionResult.error.message);
      setNotice({ type: "error", text: t.actionFailed });
    }
    else if (solutionResult.data) setSavedSolution(solutionResult.data as Solution);
  }

  async function solveProblem(force = false) {
    if (!selectedProblem) return;
    setSolving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: selectedProblem.id, force, hint: solveHint.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t.solveFailed);
      setSavedSolution(data.solution as Solution);
      setSolvedIds((current) => new Set(current).add(selectedProblem.id));
      setChat([]);
    } catch (error) {
      console.error("Could not solve problem:", error);
      setNotice({ type: "error", text: t.solveFailed });
    } finally {
      setSolving(false);
    }
  }

  async function askFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!selectedProblem || !question.trim()) return;
    const currentQuestion = question.trim();
    setQuestion("");
    setChatBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: selectedProblem.id, question: currentQuestion }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t.chatFailed);
      setChat((current) => [...current, { question: currentQuestion, answer: data.answer }]);
    } catch (error) {
      setQuestion(currentQuestion);
      console.error("Could not answer follow-up:", error);
      setNotice({ type: "error", text: t.chatFailed });
    } finally {
      setChatBusy(false);
    }
  }

  async function moveProblem(topicId: string) {
    if (!selectedProblem) return;
    const { error } = await supabase.from("problems").update({ topic_id: topicId }).eq("id", selectedProblem.id);
    if (error) {
      console.error("Could not move problem:", error.message);
      setNotice({ type: "error", text: t.actionFailed });
      return;
    }
    setMoving(false);
    setSelectedProblem(null);
    setNotice({ type: "success", text: t.moved });
    await refresh();
  }

  async function removeProblem() {
    if (!selectedProblem) return;
    setProblemMenu(false);
    if (!window.confirm(`${t.deleteProblem}\n${t.deleteProblemBody}`)) return;
    const { error: storageError } = await supabase.storage.from("problems").remove([selectedProblem.image_path]);
    if (storageError) {
      console.error("Could not delete problem image:", storageError.message);
      setNotice({ type: "error", text: t.actionFailed });
      return;
    }
    const { error } = await supabase.from("problems").delete().eq("id", selectedProblem.id);
    if (error) {
      console.error("Could not delete problem:", error.message);
      setNotice({ type: "error", text: t.actionFailed });
      return;
    }
    setSelectedProblem(null);
    await refresh();
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out:", error.message);
      setNotice({ type: "error", text: t.actionFailed });
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileSidebar ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <BrandMark />
          <span className="brand-caption">{t.subtitle}</span>
          <button className="mobile-close icon-button" aria-label={t.close} onClick={() => setMobileSidebar(false)}><X size={19} /></button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-label">{t.library}</div>
          <button className={`nav-item ${!selectedTopic ? "nav-item-active" : ""}`} onClick={() => { setSelectedTopic(null); setMobileSidebar(false); }}>
            <LayoutGrid size={17} /><span>{t.allProblems}</span><span className="nav-count">{problems.length}</span>
          </button>
          <div className="topic-heading">
            <span>{t.topics}</span>
            <button className="icon-button topic-add" aria-label={t.addTopic} onClick={openCreateTopic}><Plus size={16} /></button>
          </div>
          <div className="topic-list">
            {topics.map((topic, index) => (
              <div className="topic-row-wrap" key={topic.id}>
                <button className={`nav-item topic-nav ${selectedTopic === topic.id ? "nav-item-active" : ""}`} onClick={() => { setSelectedTopic(topic.id); setMobileSidebar(false); }}>
                  <span className={`topic-dot topic-dot-${index % 5}`} /><span className="topic-name">{topic.name}</span>
                  <span className="nav-count">{problems.filter((problem) => problem.topic_id === topic.id).length}</span>
                </button>
                <button className="topic-menu-trigger" aria-label={t.deleteTopicOptions.replace("{topic}", topic.name)} onClick={() => setTopicMenu(topicMenu === topic.id ? null : topic.id)}><MoreHorizontal size={16} /></button>
                {topicMenu === topic.id && <div className="small-menu">
                  <button onClick={() => openEditTopic(topic)}><Pencil size={14} />{t.rename}</button>
                  <button className="danger-menu" onClick={() => void removeTopic(topic)}><Trash2 size={14} />{t.delete}</button>
                </div>}
              </div>
            ))}
            {!topics.length && !loading && <p className="sidebar-empty">{t.welcomeTopicsEmpty}</p>}
          </div>
          <button className="add-topic-link" onClick={openCreateTopic}><FolderPlus size={16} />{t.addTopic}</button>
        </div>
        <div className="sidebar-bottom">
          <div className="progress-card">
            <div className="progress-card-icon"><GraduationCap size={17} /></div>
            <div><strong>{solvedCount} {t.solvedCount}</strong><span>{problems.length} {t.yourProblems}</span></div>
            <div className="mini-progress"><span style={{ width: `${problems.length ? Math.round((solvedCount / problems.length) * 100) : 0}%` }} /></div>
          </div>
          <div className="user-row">
            <div className="avatar">{(user.email?.[0] ?? "S").toUpperCase()}</div>
            <div className="user-email">{user.email ?? t.student}</div>
            <button className="icon-button signout-button" title={t.signOut} onClick={() => void signOut()}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {mobileSidebar && <button className="sidebar-scrim" aria-label={t.close} onClick={() => setMobileSidebar(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button mobile-menu" aria-label={t.menu} onClick={() => setMobileSidebar(true)}><Menu size={19} /></button>
            <div className="breadcrumb"><span>{t.workspace}</span><ChevronRight size={14} /><strong>{currentTopic?.name ?? t.allProblems}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="search-box"><Search size={16} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} aria-label={t.search} /><kbd>⌘ K</kbd></div>
            <button className="icon-button setting-button" title={t.language} onClick={() => onLanguage(language === "en" ? "mn" : "en")}><Languages size={18} /><span>{t.languageCode}</span></button>
            <button className="icon-button theme-button" title={t.theme} onClick={onTheme}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="primary-button top-upload" onClick={openUpload}><Plus size={17} /><span>{t.upload}</span></button>
          </div>
        </header>
        <section
          className={`content-area ${dragging ? "content-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
          onDrop={onDrop}
        >
          {dragging && <div className="drop-overlay"><div className="drop-overlay-card"><CloudUpload size={30} /><strong>{t.dropFiles}</strong><span>{t.fileHint}</span></div></div>}
          {loading ? (
            <div className="center-loading"><LoaderCircle className="spin" size={22} />{t.loading}</div>
          ) : !topics.length ? (
            <div className="welcome-panel">
              <div className="welcome-art">
                <div className="art-sun" />
                <div className="art-paper"><InlineMath math="y = x^2 + 3x" /><span className="art-answer">x = −3</span><span className="art-check">✓</span></div>
                <div className="art-pencil" />
                <div className="art-sparkle sparkle-one">✳</div><div className="art-sparkle sparkle-two">✦</div>
              </div>
              <div className="welcome-copy"><div className="eyebrow"><Sparkles size={14} /> {t.welcomeKicker}</div><h1>{t.welcome}</h1><p>{t.description}</p><div className="welcome-actions"><button className="primary-button" onClick={openCreateTopic}><Plus size={17} />{t.addTopic}</button><button className="secondary-button" onClick={() => { setShowTopicDialog(true); setEditingTopic(null); setTopicName(""); }}><ImagePlus size={17} />{t.uploadFirst}</button></div><div className="welcome-note"><CheckCircle2 size={15} />{t.welcomeNote}</div></div>
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div><div className="eyebrow page-eyebrow"><BookOpen size={14} /> {currentTopic ? t.topics.toUpperCase() : t.library}</div><h1>{currentTopic?.name ?? t.allProblems}</h1><p>{topicProblems.length} {t.yourProblems} <span className="heading-dot">·</span> {topicProblems.filter((problem) => solvedIds.has(problem.id)).length} {t.solvedCount}</p></div>
                <button className="secondary-button add-problems-button" onClick={openUpload}><ImagePlus size={16} />{t.addMore}</button>
              </div>
              <div className="toolbar">
                <div className="filter-tabs">
                  {(["all", "solved", "unsolved"] as const).map((value) => <button key={value} className={filter === value ? "filter-active" : ""} onClick={() => setFilter(value)}>{value === "all" ? t.all : value === "solved" ? t.solvedOnly : t.unsolvedOnly}</button>)}
                </div>
                <label className="sort-control"><ArrowDownWideNarrow size={15} /><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label={t.sortProblems}><option value="recent">{t.recent}</option><option value="oldest">{t.oldest}</option><option value="title">{t.titleAZ}</option></select><ChevronDown size={14} /></label>
              </div>
              {filteredProblems.length ? <div className="problem-grid">
                {filteredProblems.map((problem, index) => <ProblemCard
                  key={problem.id}
                  problem={problem}
                  topicName={topics.find((topic) => topic.id === problem.topic_id)?.name ?? ""}
                  solved={solvedIds.has(problem.id)}
                  index={index}
                  supabase={supabase}
                  language={language}
                  onClick={() => void openProblem(problem)}
                />)}
              </div> : <div className="empty-state"><div className="empty-state-icon">{search || filter !== "all" ? <Search size={22} /> : <FileImage size={22} />}</div><h3>{search || filter !== "all" ? t.noResults : t.noProblems}</h3><p>{search || filter !== "all" ? t.noResultsHint : t.noProblemsHint}</p>{!search && filter === "all" && <button className="primary-button" onClick={openUpload}><Plus size={16} />{t.upload}</button>}</div>}
            </>
          )}
        </section>
      </main>

      {notice && <div className={`toast toast-${notice.type}`} role="status"><span>{notice.type === "error" ? <CircleHelp size={16} /> : <CheckCircle2 size={16} />}{notice.text}</span><button aria-label={t.close} onClick={() => setNotice(null)}><X size={15} /></button></div>}

      {showTopicDialog && <Modal onClose={() => setShowTopicDialog(false)} ariaLabel={editingTopic ? t.rename : t.newTopic}>
        <form className="dialog-card topic-dialog" onSubmit={(event) => void saveTopic(event)}>
          <DialogHeader icon={<FolderPlus size={19} />} title={editingTopic ? t.rename : t.newTopic} onClose={() => setShowTopicDialog(false)} t={t} />
          <label className="field-label">{t.topicName}<input autoFocus maxLength={60} required value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder={t.topicPlaceholder} /></label>
          <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setShowTopicDialog(false)}>{t.cancel}</button><button type="submit" className="primary-button">{editingTopic ? t.save : t.create}<ChevronRight size={15} /></button></div>
        </form>
      </Modal>}

      {showUpload && <Modal onClose={() => !uploading && setShowUpload(false)} ariaLabel={t.upload}>
        <form className="dialog-card upload-dialog" onSubmit={(event) => void uploadFiles(event)}>
          <DialogHeader icon={<CloudUpload size={19} />} title={t.upload} onClose={() => !uploading && setShowUpload(false)} t={t} />
          {topics.length > 0 && <label className="field-label">{t.selectTopic}<select required value={uploadTopic} onChange={(event) => setUploadTopic(event.target.value)}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>}
          <div className={`upload-dropzone ${files.length ? "upload-dropzone-has-files" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,application/pdf,.pdf" multiple hidden onChange={(event) => { if (event.target.files) chooseFiles(event.target.files); event.target.value = ""; }} />
            <div className="upload-icon"><CloudUpload size={23} /></div><strong>{t.dropFiles}</strong><span>{t.or} <button type="button" onClick={() => inputRef.current?.click()}>{t.browse}</button></span><small>{t.fileHint}</small>
          </div>
          {files.length > 0 && <div className="file-list">{files.map((file, index) => <UploadFileRow key={`${file.name}-${index}`} file={file} removable={!uploading} onRemove={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} closeLabel={t.close} previewLabel={t.filePreviewAlt} />)}</div>}
          {uploading && <div className="upload-progress"><div><span>{t.uploading}</span><span>{uploadProgress}%</span></div><span className="progress-track"><span style={{ width: `${uploadProgress}%` }} /></span></div>}
          {topics.length === 0 && <p className="inline-hint">{t.createTopicFirst}</p>}
          <div className="dialog-actions"><button type="button" className="secondary-button" disabled={uploading} onClick={() => setShowUpload(false)}>{t.cancel}</button><button type="submit" className="primary-button" disabled={uploading || !files.length || !topics.length}>{uploading ? <LoaderCircle className="spin" size={16} /> : <CloudUpload size={16} />}{uploading ? t.uploading : t.upload}</button></div>
        </form>
      </Modal>}

      {selectedProblem && <Modal onClose={() => setSelectedProblem(null)} ariaLabel={selectedProblem.title} wide>
        <div className="problem-detail">
          <div className="detail-topline"><button className="back-button" onClick={() => setSelectedProblem(null)}><ArrowLeft size={17} />{t.allProblems}</button><div className="detail-actions"><button className="icon-button detail-more" aria-label={t.problemOptions} onClick={() => setProblemMenu((current) => !current)}><MoreHorizontal size={19} /></button>{problemMenu && <div className="detail-menu">
            <button onClick={() => { setMoving(true); setProblemMenu(false); }}><FolderPlus size={15} />{t.move}</button>
            <button className="danger-menu" onClick={() => void removeProblem()}><Trash2 size={15} />{t.delete}</button>
          </div>}</div></div>
          <div className="detail-content">
            <div className="detail-image-column">
              <div className="detail-image-wrap">{signedImage ? <Image loader={({ src }) => src} src={signedImage} alt={t.imageAlt.replace("{title}", selectedProblem.title)} width={1200} height={900} sizes="(max-width: 760px) 100vw, 48vw" unoptimized /> : <div className="image-loading"><LoaderCircle className="spin" size={22} /></div>}</div>
                  <div className="detail-image-caption"><span><FileImage size={15} />{selectedProblem.title}</span><span>{new Date(selectedProblem.created_at).toLocaleDateString(language === "mn" ? "mn-MN" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
            </div>
            <div className="detail-solution-column">
              <div className="detail-topic"><span className="topic-dot topic-dot-0" />{topics.find((topic) => topic.id === selectedProblem.topic_id)?.name}</div>
              {!savedSolution ? <div className="solve-intro"><div className="solve-sparkle"><Sparkles size={20} /></div><h2>{t.solveTitle}</h2><p>{t.chooseProblem}</p><button className="primary-button solve-button" disabled={solving || !signedImage} onClick={() => void solveProblem()}>{solving ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{solving ? t.solving : t.solve}</button><label className="solve-hint-field">Нэмэлт заавар (заавал биш)<textarea maxLength={300} value={solveHint} onChange={(event) => setSolveHint(event.target.value)} placeholder="Жишээ: хэсэгчилсэн бутархайгаар бод" rows={2} /></label><span className="ai-note"><span className="ai-dot" />{t.solveNote}</span></div> : <>
                <div className="solution-title-row"><div><div className="eyebrow"><Sparkles size={13} /> {t.solvedBadge.toUpperCase()}</div><h2>{t.solution}</h2></div><button className="text-button" disabled={solving} onClick={() => void solveProblem(true)}>{solving ? <LoaderCircle className="spin" size={15} /> : <ArrowLeft className="redo-icon" size={14} />}{t.reSolve}</button></div>
                <div className="solution-body"><MarkdownMath>{savedSolution.content}</MarkdownMath></div>
                <p className="ai-disclaimer">AI-ийн бодолтыг заавал шалгаарай.</p>
                <div className="followup-section"><div className="followup-heading"><div className="followup-icon"><CircleHelp size={16} /></div><div><strong>{t.ask}</strong><span>{t.askHint}</span></div></div>
                  {chat.map((item, index) => <div className="chat-pair" key={`${index}-${item.question}`}><div className="chat-question">{item.question}</div><div className="chat-answer"><MarkdownMath>{item.answer}</MarkdownMath><p className="ai-disclaimer">AI-ийн бодолтыг заавал шалгаарай.</p></div></div>)}
                  <form className="followup-input" onSubmit={(event) => void askFollowUp(event)}><input maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.askPlaceholder} /><button disabled={chatBusy || !question.trim()} aria-label={t.send}>{chatBusy ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />}</button></form>
                </div>
              </>}
            </div>
          </div>
        </div>
      </Modal>}

      {moving && selectedProblem && <Modal onClose={() => setMoving(false)} ariaLabel={t.move}>
        <div className="dialog-card topic-dialog"><DialogHeader icon={<FolderPlus size={19} />} title={t.move} onClose={() => setMoving(false)} t={t} /><div className="move-topic-list">{topics.filter((topic) => topic.id !== selectedProblem.topic_id).map((topic) => <button key={topic.id} onClick={() => void moveProblem(topic.id)}><span className="topic-dot topic-dot-0" />{topic.name}<ChevronRight size={15} /></button>)}{topics.length <= 1 && <p className="inline-hint">{t.noOtherTopics}</p>}</div></div>
      </Modal>}
    </div>
  );
}

function ProblemCard({
  problem, topicName, solved, index, supabase, language, onClick,
}: {
  problem: Problem; topicName: string; solved: boolean; index: number;
  supabase: NonNullable<ReturnType<typeof useSupabase>>; language: Language; onClick: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.storage.from("problems").createSignedUrl(problem.image_path, 60 * 60).then(({ data, error }) => {
      if (!active) return;
      if (error) setImageFailed(true);
      else setImage(data.signedUrl);
    });
    return () => { active = false; };
  }, [problem.image_path, supabase]);
  return (
    <button className="problem-card" onClick={onClick} style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}>
      <div className="card-image">
        {image ? <Image loader={({ src }) => src} src={image} alt={getTranslations(language).imageAlt.replace("{title}", problem.title)} width={800} height={600} sizes="(max-width: 760px) 50vw, 33vw" unoptimized /> : imageFailed ? <div className="card-image-fallback"><FileImage size={24} /></div> : <div className="card-image-loading"><LoaderCircle className="spin" size={18} /></div>}
        <div className="card-image-overlay" />
        {solved && <span className="solved-badge"><Check size={12} />{getTranslations(language).solvedBadge}</span>}
        <span className="card-open-arrow"><ChevronRight size={17} /></span>
      </div>
      <div className="problem-card-info"><div className="problem-card-title">{problem.title}</div><div className="problem-card-meta"><span className="card-topic">{topicName}</span><span className="meta-dot" /><span><Clock3 size={12} />{new Date(problem.created_at).toLocaleDateString(language === "mn" ? "mn-MN" : "en-US", { month: "short", day: "numeric" })}</span></div></div>
    </button>
  );
}

function UploadFileRow({ file, removable, onRemove, closeLabel, previewLabel }: { file: File; removable: boolean; onRemove: () => void; closeLabel: string; previewLabel: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isAcceptedImageType(file.type)) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="file-row">
      {previewUrl
        ? <Image className="upload-file-preview" loader={({ src }) => src} src={previewUrl} alt={previewLabel.replace("{name}", file.name)} width={36} height={36} unoptimized />
        : <span className="file-icon">{file.type === "application/pdf" ? <FileText size={17} /> : <FileImage size={17} />}</span>}
      <span className="file-info"><strong>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></span>
      {removable && <button type="button" className="icon-button" aria-label={closeLabel} onClick={onRemove}><X size={15} /></button>}
    </div>
  );
}

function Modal({ children, onClose, ariaLabel, wide = false }: { children: ReactNode; onClose: () => void; ariaLabel: string; wide?: boolean }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal-panel ${wide ? "modal-panel-wide" : ""}`} role="dialog" aria-modal="true" aria-label={ariaLabel}>{children}</div></div>;
}

function DialogHeader({ icon, title, onClose, t }: { icon: ReactNode; title: string; onClose: () => void; t: Dictionary }) {
  return <div className="dialog-header"><div className="dialog-title-icon">{icon}</div><div><h2>{title}</h2></div><button type="button" className="icon-button" aria-label={t.close} onClick={onClose}><X size={18} /></button></div>;
}

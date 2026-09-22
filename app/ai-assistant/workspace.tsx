"use client";

import {
  ArrowUp,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  LayoutTemplate,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Square,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { sendAssistantMessage, type AssistantAction, type AssistantChatMessage } from "@/app/ai-assistant/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UiMessage = AssistantChatMessage & {
  id: string;
  actionResult?: {
    label: string;
    href?: string;
  };
};

type VoiceState = "idle" | "connecting" | "listening" | "processing" | "error";

const suggestions = [
  { label: "Create a task for tomorrow", icon: CalendarDays, color: "text-sky-600", bg: "bg-sky-50" },
  { label: "Add meeting reminder on calendar", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Summarize my notes", icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
  { label: "Create a Kanban board", icon: Plus, color: "text-teal-600", bg: "bg-teal-50" },
  { label: "Plan my week", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50" },
  { label: "Generate a habit tracker template", icon: LayoutTemplate, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
];

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function AiAssistantWorkspace() {
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [prompt, setPrompt] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState<AssistantAction | null>(null);
  const [isResponding, setIsResponding] = React.useState(false);
  const [error, setError] = React.useState("");
  const [voiceState, setVoiceState] = React.useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = React.useState("");
  const [liveTranscript, setLiveTranscript] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const voiceRef = React.useRef<{
    ws: WebSocket | null;
    audioContext: AudioContext | null;
    stream: MediaStream | null;
    source: MediaStreamAudioSourceNode | null;
    worklet: AudioWorkletNode | null;
    transcript: string;
  }>({
    ws: null,
    audioContext: null,
    stream: null,
    source: null,
    worklet: null,
    transcript: "",
  });
  const liveTranscriptRef = React.useRef("");
  const submitPromptRef = React.useRef<(value: string) => void | Promise<void>>(() => undefined);

  React.useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isResponding]);

  async function submitPrompt(value = prompt) {
    const text = value.trim();
    if (!text || isResponding) {
      return;
    }

    setPrompt("");
    setError("");
    setIsResponding(true);

    const userMessage: UiMessage = { id: newId(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const response = await sendAssistantMessage(
        nextMessages.map(({ role, content }) => ({ role, content })),
        pendingAction
      );
      setPendingAction(response.pendingAction ?? null);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: response.content,
          actionResult: response.actionResult,
        },
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to reach AI Assistant.");
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: caughtError instanceof Error ? caughtError.message : "Unable to reach AI Assistant.",
        },
      ]);
    } finally {
      setIsResponding(false);
      textareaRef.current?.focus();
    }
  }

  React.useEffect(() => {
    submitPromptRef.current = submitPrompt;
  });

  async function startVoice() {
    setVoiceError("");
    setLiveTranscript("");
    setVoiceState("connecting");

    try {
      const tokenResponse = await fetch("/api/assemblyai-token", { cache: "no-store" });
      const tokenBody = (await tokenResponse.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!tokenResponse.ok || !tokenBody?.token) {
        throw new Error(tokenBody?.error || "Unable to start voice dictation.");
      }

      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("This browser does not support audio recording.");
      }

      const audioContext = new AudioContextConstructor();
      await audioContext.resume();
      await audioContext.audioWorklet.addModule("/assemblyai-pcm-processor.js");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      const source = audioContext.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioContext, "assemblyai-pcm-processor", {
        processorOptions: {
          inputSampleRate: audioContext.sampleRate,
          targetSampleRate: 24000,
        },
      });

      source.connect(worklet);
      const wsUrl = new URL("wss://agents.assemblyai.com/v1/ws");
      wsUrl.searchParams.set("token", tokenBody.token);
      const ws = new WebSocket(wsUrl);
      let ready = false;

      voiceRef.current = {
        ws,
        audioContext,
        stream,
        source,
        worklet,
        transcript: "",
      };

      worklet.port.onmessage = (event) => {
        if (!ready || ws.readyState !== WebSocket.OPEN) {
          return;
        }
        ws.send(JSON.stringify({ type: "input.audio", audio: arrayBufferToBase64(event.data) }));
      };

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt:
                "You are a speech dictation helper for a productivity app. Listen to the user command and keep agent replies extremely short. Do not perform app actions yourself.",
              input: {
                format: { encoding: "audio/pcm", sample_rate: 24000 },
                turn_detection: {
                  vad_threshold: 0.5,
                  min_silence: 1200,
                  max_silence: 4000,
                  interrupt_response: true,
                },
              },
              output: {
                format: { encoding: "audio/pcm", sample_rate: 24000 },
                voice: "ivy",
              },
            },
          })
        );
      });

      ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as { type?: string; text?: string; message?: string; code?: string };
        if (message.type === "session.ready") {
          ready = true;
          setVoiceState("listening");
          return;
        }
        if (message.type === "transcript.user" && message.text) {
          voiceRef.current.transcript = `${voiceRef.current.transcript} ${message.text}`.trim();
          setLiveTranscript(voiceRef.current.transcript);
          return;
        }
        if (message.type === "transcript.user.delta" && message.text) {
          setLiveTranscript(`${voiceRef.current.transcript} ${message.text}`.trim());
          return;
        }
        if (message.type === "error" || message.type === "session.error") {
          throw new Error(message.message || message.code || "Voice dictation failed.");
        }
      });

      ws.addEventListener("close", () => {
        if (voiceState !== "processing") {
          cleanupVoice();
        }
      });
    } catch (caughtError) {
      cleanupVoice();
      setVoiceState("error");
      setVoiceError(caughtError instanceof Error ? caughtError.message : "Unable to start voice dictation.");
    }
  }

  const cleanupVoice = React.useCallback(() => {
    const current = voiceRef.current;
    current.worklet?.disconnect();
    current.source?.disconnect();
    current.stream?.getTracks().forEach((track) => track.stop());
    void current.audioContext?.close().catch(() => undefined);
    voiceRef.current = {
      ws: null,
      audioContext: null,
      stream: null,
      source: null,
      worklet: null,
      transcript: current.transcript,
    };
  }, []);

  const stopVoice = React.useCallback((shouldSubmit = true) => {
    const current = voiceRef.current;
    const transcript = current.transcript.trim() || liveTranscriptRef.current.trim();
    setVoiceState("processing");

    if (current.ws?.readyState === WebSocket.OPEN) {
      current.ws.send(JSON.stringify({ type: "session.end" }));
      current.ws.close();
    }
    cleanupVoice();

    if (shouldSubmit && transcript) {
      setVoiceState("idle");
      setLiveTranscript("");
      void submitPromptRef.current(transcript);
    } else {
      setVoiceState("idle");
    }
  }, [cleanupVoice]);

  React.useEffect(() => {
    return () => {
      stopVoice(false);
    };
  }, [stopVoice]);

  function toggleVoice() {
    if (voiceState === "listening" || voiceState === "connecting") {
      stopVoice(true);
      return;
    }
    void startVoice();
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Command center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">AI Assistant</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-teal-100 bg-primary-soft/80 px-3 py-2 text-sm font-semibold text-teal-800">
          <Bot className="h-4 w-4" aria-hidden="true" />
          Workspace-aware
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6">
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col rounded-lg border border-border/75 bg-card/95 shadow-sm shadow-slate-900/[0.025]">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[calc(100dvh-260px)] flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-teal-900/10">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-foreground">AI Assistant</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Ask questions, plan work, create tasks, write notes, and send actions across your Flowbase workspace.
                </p>
                <div className="mt-7 grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={suggestion.label}
                        className="group flex min-h-[84px] min-w-0 flex-col rounded-lg border border-border/75 bg-background/85 p-3 text-left transition-colors hover:border-primary/35 hover:bg-accent/60"
                        type="button"
                        onClick={() => submitPrompt(suggestion.label)}
                      >
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", suggestion.bg)}>
                          <Icon className={cn("h-4 w-4", suggestion.color)} aria-hidden="true" />
                        </span>
                        <span className="mt-3 text-sm font-semibold leading-5 text-foreground">{suggestion.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <article key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                    {message.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Bot className="h-4 w-4" aria-hidden="true" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[min(760px,92%)] rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm",
                        message.role === "user"
                          ? "border-teal-100 bg-primary text-primary-foreground shadow-teal-900/10"
                          : "border-border/75 bg-background/90 text-foreground shadow-slate-900/[0.025]"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.actionResult?.href && (
                        <Button asChild className="mt-3 h-8 rounded-lg gap-2" size="sm" variant="outline">
                          <Link href={message.actionResult.href}>
                            {message.actionResult.label}
                            <ArrowUp className="h-3.5 w-3.5 rotate-45" aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
                {isResponding && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border/75 bg-background/90 px-4 py-3 text-sm font-medium text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border/75 bg-card/95 p-3 sm:p-4">
            {(liveTranscript || voiceState !== "idle" || voiceError) && (
              <div
                className={cn(
                  "mb-3 rounded-lg border px-3 py-2 text-sm",
                  voiceState === "error" ? "border-destructive/25 bg-red-50 text-destructive" : "border-teal-100 bg-primary-soft/65 text-teal-800"
                )}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {voiceState === "listening" ? <Mic className="h-4 w-4" /> : voiceState === "error" ? <MicOff className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                  {voiceState === "listening" ? "Listening" : voiceState === "connecting" ? "Connecting microphone" : voiceState === "processing" ? "Processing voice" : voiceState === "error" ? "Voice error" : "Voice dictation"}
                </div>
                {(liveTranscript || voiceError) && <p className="mt-1 whitespace-pre-wrap leading-6">{voiceError || liveTranscript}</p>}
              </div>
            )}

            {error && <p className="mb-3 rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}

            <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-2 shadow-sm shadow-slate-900/[0.025] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <textarea
                ref={textareaRef}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                placeholder="Ask AI to plan, write, summarize, or create something..."
                rows={1}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitPrompt();
                  }
                }}
              />
              <Button
                aria-label={voiceState === "listening" || voiceState === "connecting" ? "Stop voice dictation" : "Start voice dictation"}
                className={cn("h-10 w-10 shrink-0 rounded-lg", voiceState === "listening" && "bg-rose-600 hover:bg-rose-700")}
                disabled={isResponding || voiceState === "processing"}
                size="icon"
                type="button"
                variant={voiceState === "idle" || voiceState === "error" ? "outline" : "default"}
                onClick={toggleVoice}
              >
                {voiceState === "listening" || voiceState === "connecting" ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <Button
                aria-label="Send prompt"
                className="h-10 w-10 shrink-0 rounded-lg"
                disabled={isResponding || !prompt.trim()}
                size="icon"
                type="button"
                onClick={() => submitPrompt()}
              >
                {isResponding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Enter sends. Shift+Enter adds a new line.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

export default function ChatConversationPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = trpc.chat.getMessages.useQuery(
    { matchId, limit: 50 },
    { refetchInterval: 3000 }
  );

  const { data: conversations } = trpc.chat.getConversations.useQuery();
  const currentConv = conversations?.find((c) => c.matchId === matchId);

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    },
  });

  const markReadMutation = trpc.chat.markRead.useMutation();

  useEffect(() => {
    if (matchId) markReadMutation.mutate({ matchId });
  }, [matchId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!message.trim()) return;
    sendMutation.mutate({ matchId, content: message.trim() });
  }

  const otherName = currentConv?.otherUser?.displayName || "Traveler";

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push("/chat")} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <Avatar className="w-9 h-9">
          {currentConv?.otherUser?.avatarUrl && <AvatarImage src={currentConv.otherUser.avatarUrl} alt={otherName} />}
          <AvatarFallback className="bg-[#3f6f60] text-white text-sm font-bold">{otherName[0]}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold text-sm">{otherName}</h2>
          <p className="text-[10px] text-green-500">Active now</p>
        </div>
      </div>

      {/* Quick chips */}
      <div className="flex gap-2 px-4 py-2 bg-[#D9EDBF]/20 overflow-x-auto shrink-0">
        <Badge
          variant="outline"
          className="cursor-pointer whitespace-nowrap text-xs px-3 py-1.5 rounded-full bg-[#ff8c30] text-white border-[#ff8c30] hover:bg-[#e67a20] font-semibold"
          onClick={() => router.push(`/plan?with=${matchId}`)}
        >
          Plan together
        </Badge>
        {["Suggest place", "Tonight?"].map((chip) => (
          <Badge
            key={chip}
            variant="outline"
            className="cursor-pointer whitespace-nowrap text-xs px-3 py-1 rounded-full hover:bg-[#ff8c30]/10 hover:border-[#ff8c30]"
            onClick={() => setMessage(chip)}
          >
            {chip}
          </Badge>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">You matched! Say hello to start planning together.</p>
          </div>
        )}
        {messages?.map((msg) => {
          const isMine = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? "bg-[#ff8c30] text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="bg-white border-t px-4 py-3 flex gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="rounded-full h-10"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          className="rounded-full h-10 w-10 p-0 bg-[#ff8c30] hover:bg-[#e67a20] shrink-0"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

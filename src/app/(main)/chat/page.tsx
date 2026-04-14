"use client";

import Link from "next/link";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const STATUS_BADGES = ["Exploring Now", "Nearby", "Tonight", "Free Today", "Morning Walk"];

export default function ChatInboxPage() {
  const { data: conversations, isLoading: convLoading } = trpc.chat.getConversations.useQuery();
  const { data: matches, isLoading: matchLoading } = trpc.match.getMatches.useQuery();

  const recentMatches = matches?.slice(0, 5) || [];

  return (
    <PageTransition><div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar className="w-9 h-9 border-2 border-[#ff8c30]/20">
            <AvatarFallback className="bg-[#3f6f60] text-white font-bold text-xs">I</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">Inbox</h1>
        </div>
        <svg className="w-5 h-5 text-[#ff8c30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      {/* New Matches */}
      {recentMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#3f6f60]">New Matches</h2>
            <Badge className="bg-[#ff8c30] border-0 text-white text-[10px]">{recentMatches.length} New</Badge>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {recentMatches.map((m) => (
              <Link key={m.id} href={`/chat/${m.id}`} className="shrink-0">
                <div className="flex flex-col items-center gap-1.5 w-16">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-[#90D26D]">
                      {m.otherUser?.avatarUrl && <AvatarImage src={m.otherUser.avatarUrl} alt={m.otherUser.displayName || ""} />}
                      <AvatarFallback className="bg-[#3f6f60] text-white text-sm font-bold">{(m.otherUser?.displayName || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#90D26D] border-2 border-white rounded-full" />
                  </div>
                  <p className="text-[10px] text-center truncate w-full font-medium">{m.otherUser?.displayName?.split(" ")[0]}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      <div>
        <h2 className="font-semibold text-[#3f6f60] mb-3">Conversations</h2>
        {convLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : conversations?.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No conversations yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Match with travelers to start chatting!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations?.map((conv, idx) => (
              <Link key={conv.matchId} href={`/chat/${conv.matchId}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        {conv.otherUser?.avatarUrl && <AvatarImage src={conv.otherUser.avatarUrl} alt={conv.otherUser.displayName || ""} />}
                        <AvatarFallback className="bg-[#3f6f60] text-white font-bold">
                          {(conv.otherUser?.displayName || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      {idx < 2 && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#90D26D] border-2 border-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-sm truncate">{conv.otherUser?.displayName}</h3>
                          {idx < 2 && <svg className="w-3.5 h-3.5 text-[#90D26D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                        </div>
                        <Badge
                          className="text-[9px] border-0 px-1.5 py-0.5"
                          style={{
                            backgroundColor: idx % 3 === 0 ? "#ff8c3015" : idx % 3 === 1 ? "#90D26D15" : "#3f6f6015",
                            color: idx % 3 === 0 ? "#ff8c30" : idx % 3 === 1 ? "#90D26D" : "#3f6f60",
                          }}
                        >
                          {STATUS_BADGES[idx % STATUS_BADGES.length]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.lastMessage?.content || "You matched! Say hello"}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[#ff8c30] flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">{conv.unreadCount}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div></PageTransition>
  );
}

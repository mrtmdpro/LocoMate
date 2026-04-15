"use client";

import Link from "next/link";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const STATUS_BADGES = ["Online", "Exploring Now", "Available", "Free Today", "Host"];

export default function ChatInboxPage() {
  const { data: conversations, isLoading: convLoading } = trpc.chat.getConversations.useQuery();

  return (
    <PageTransition><div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">Messages</h1>
        <svg className="w-5 h-5 text-[#ff8c30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </div>

      {convLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : conversations?.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-muted-foreground font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1">Book an experience or tour to chat with your host!</p>
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
                      {conv.lastMessage?.content || "Say hello!"}
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
    </div></PageTransition>
  );
}

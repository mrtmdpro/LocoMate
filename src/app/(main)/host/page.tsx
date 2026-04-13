"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { useState } from "react";
import { toast } from "sonner";

export default function HostDashboardPage() {
  const { user } = useAuthStore();
  const [accepting, setAccepting] = useState(true);

  const mockBookings = [
    { id: "1", name: "Sarah K.", time: "12:30 PM", tour: "Bun Cha Lunch Tour", status: "confirmed" },
    { id: "2", name: "Mark W.", time: "3:00 PM", tour: "Old Quarter Walk", status: "confirmed" },
  ];

  const mockRequests = [
    { id: "3", name: "Elena R.", tour: "Photography Tour", time: "Tomorrow 10AM" },
  ];

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good morning,</p>
          <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">
            {user?.displayName?.split(" ")[0]}!
          </h1>
        </div>
        <Avatar className="w-12 h-12">
          {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
          <AvatarFallback className="bg-[#3f6f60] text-white font-bold">{(user?.displayName || "?")[0]}</AvatarFallback>
        </Avatar>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today", value: "120k", sub: "VND" },
          { label: "Rating", value: "4.9", sub: "★" },
          { label: "Total", value: "25", sub: "tours" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-[#3f6f60]">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label} {stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Availability Toggle */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#3f6f60]">Accepting Requests</h3>
            <p className="text-xs text-muted-foreground">Toggle your availability for today</p>
          </div>
          <Switch checked={accepting} onCheckedChange={setAccepting} />
        </CardContent>
      </Card>

      {/* Today's Bookings */}
      <div>
        <h2 className="font-semibold text-[#3f6f60] mb-3">Today&apos;s Bookings</h2>
        <div className="space-y-2">
          {mockBookings.map((booking) => (
            <Card key={booking.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-[#ff8c30] text-white text-sm font-bold">{booking.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{booking.tour}</p>
                  <p className="text-xs text-muted-foreground">with {booking.name} at {booking.time}</p>
                </div>
                <Badge className="bg-[#90D26D] text-white border-0 text-[10px]">{booking.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Requests */}
      <div>
        <h2 className="font-semibold text-[#3f6f60] mb-3">New Requests</h2>
        {mockRequests.map((req) => (
          <Card key={req.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-[#3f6f60] text-white text-sm font-bold">{req.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{req.name} wants a {req.tour}</p>
                  <p className="text-xs text-muted-foreground">{req.time}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 h-10 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white text-sm" onClick={() => toast.success("Request accepted!")}>Accept</Button>
                <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={() => toast("Request declined")}>Decline</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12 rounded-xl text-sm">Update Profile</Button>
        <Button variant="outline" className="h-12 rounded-xl text-sm">Add Experience</Button>
      </div>
    </div>
  );
}

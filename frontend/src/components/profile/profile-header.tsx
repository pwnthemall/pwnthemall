import React, { useEffect, useState } from "react";
import Image from "next/image";
import axios from "@/lib/axios";
import { AxiosResponse } from "axios";
import { User } from "@/models/User";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfileHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get<User>("/api/me").then((res: AxiosResponse<User>) => {
      setUser(res.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-32 w-full bg-muted rounded-lg" />;
  if (!user) return <div className="text-red-500">User not found</div>;

  return (
    <Card className="flex flex-row items-center gap-6 p-6">
      <div className="flex-shrink-0">
        <Image
          src="/logo-no-text.png"
          alt={user.username ? `${user.username}'s profile` : "Profile"}
          width={96}
          height={96}
          className="rounded-full h-24 w-24 border-4 border-background object-cover"
          priority
        />
      </div>
      <CardContent className="flex flex-col gap-1 p-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold leading-tight">{user.username}</span>
        </div>
        <span className="text-muted-foreground text-base">{user.email}</span>
        <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium w-fit mt-2">{user.role}</span>
      </CardContent>
    </Card>
  );
} 
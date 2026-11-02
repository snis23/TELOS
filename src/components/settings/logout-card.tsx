"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { getSupabase } from "@/lib/supabase/client";

export function LogoutCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = async () => {
    await getSupabase()?.auth.signOut();
    queryClient.clear();
    router.replace("/login/");
  };
  return (
    <Card title="계정">
      <Button variant="secondary" onClick={() => void logout()}>
        <LogOut size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
        로그아웃
      </Button>
    </Card>
  );
}

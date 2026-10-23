import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { Activate } from "./activate";

export default async function StartPage() {
  const { orgId } = await auth();
  if (orgId) redirect("/");

  return (
    <AuthFrame caption="Getting your workspace ready">
      <Activate />
    </AuthFrame>
  );
}

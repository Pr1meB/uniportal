import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const jar = await cookies();
  // The portal layout works out the right dashboard for the signed-in role.
  redirect(jar.has("sessionid") ? "/portal" : "/login");
}

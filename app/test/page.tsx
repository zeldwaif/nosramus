import { redirect } from "next/navigation";

/** Superseded by /setup, which runs the full configuration health check. */
export default function TestPage() {
  redirect("/setup");
}

import { createFileRoute } from "@tanstack/react-router";
import { ZubrykApp } from "@/components/zubryk-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ZubrykApp />;
}

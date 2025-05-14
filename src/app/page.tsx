import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons/logo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <header className="mb-12 text-center">
        <Logo className="h-20 w-auto mb-4 inline-block" />
        <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl md:text-6xl">
          ChatSim Schularena
        </h1>
        <p className="mt-4 max-w-2xl text-xl text-foreground/80">
          Interaktive Chat-Simulationen für den modernen Unterricht. Erleben, reflektieren und lernen Sie gemeinsam.
        </p>
      </header>

      <main className="w-full max-w-md space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/login?role=admin" passHref legacyBehavior>
            <Button variant="default" size="lg" className="w-full py-6 text-lg">
              Admin Login
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login?role=guest" passHref legacyBehavior>
            <Button variant="secondary" size="lg" className="w-full py-6 text-lg">
              Als Gast teilnehmen
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Entwickelt für den Einsatz in schulischen Kontexten unter Berücksichtigung der DSGVO.
        </p>
      </main>

      <footer className="absolute bottom-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ChatSim Schularena. Alle Rechte vorbehalten.
      </footer>
    </div>
  );
}

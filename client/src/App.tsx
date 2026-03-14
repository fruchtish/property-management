import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import Management from "@/pages/Management";
import Reports from "@/pages/Reports";
import Leases from "@/pages/Leases";
import Maintenance from "@/pages/Maintenance";
import Sync from "@/pages/Sync";
import NotFound from "@/pages/not-found";
import {
  Building2,
  LayoutDashboard,
  FileText,
  BarChart3,
  Wrench,
  RefreshCw,
} from "lucide-react";

function NavLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [location] = useLocation();
  const active = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link href={href}>
      <a
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
          active
            ? "bg-primary/15 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        data-testid={`nav-${href.replace("/", "") || "home"}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </a>
    </Link>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground" dir="rtl">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-l border-border flex flex-col bg-card">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold leading-none">ניהול נכסים</div>
              <div className="text-xs text-muted-foreground mt-0.5">BlueTower BG</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLink href="/" icon={LayoutDashboard} label="דשבורד" />

          <NavSection label="נכסים">
            <NavLink href="/management" icon={Building2} label="נכסים ובעלים" />
            <NavLink href="/leases" icon={FileText} label="חוזי שכירות" />
            <NavLink href="/maintenance" icon={Wrench} label="תחזוקה ותקלות" />
          </NavSection>

          <NavSection label="דוחות">
            <NavLink href="/reports" icon={BarChart3} label="דוחות" />
          </NavSection>

          <NavSection label="נתונים">
            <NavLink href="/sync" icon={RefreshCw} label="סנכרון Excel" />
          </NavSection>
        </nav>

        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center opacity-60">BlueTower BG © 2026</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="dark">
        <Router hook={useHashLocation}>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/management" component={Management} />
              <Route path="/leases" component={Leases} />
              <Route path="/maintenance" component={Maintenance} />
              <Route path="/reports" component={Reports} />
              <Route path="/sync" component={Sync} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Router>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;

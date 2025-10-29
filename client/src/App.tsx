import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Creator from "@/pages/Creator";
import Dashboard from "@/pages/Dashboard";
import Discover from "@/pages/Discover";
import Docs from "@/pages/Docs";
import Launch from "@/pages/Launch";
import Market from "@/pages/Market";
import Portfolio from "@/pages/Portfolio";
import Scope from "@/pages/Scope";
import Vaults from "@/pages/Vaults";
import NotFound from "@/pages/not-found";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/vaults" component={Vaults} />
      <Route path="/launch" component={Launch} />
      <Route path="/market/:symbol" component={Market} />
      <Route path="/discover" component={Discover} />
      <Route path="/docs" component={Docs} />
      <Route path="/creator" component={Creator} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/scope" component={Scope} />
      <Route path="/markets" component={Discover} />
      <Route path="/rewards">
        {() => (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h1 className="text-3xl font-bold mb-4">Rewards</h1>
            <p className="text-muted-foreground mb-6">Coming soon...</p>
            <div className="text-primary">
              🎁 Rewards system under development
            </div>
          </div>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <div className="flex flex-col h-screen w-full">
            <TopBar />
            <main className="flex-1 overflow-auto pb-16 px-4 md:px-6">
              <Router />
            </main>
            <BottomNav />
            <footer className="h-8 bg-card/80 backdrop-blur-sm border-t border-border flex items-center justify-center text-xs text-muted-foreground px-4">
              <p>
                Trading perpetuals involves risk. DYOR. Not financial advice. Alpha software.
              </p>
            </footer>
          </div>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
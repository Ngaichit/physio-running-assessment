import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

// Code-split the heavy route pages so they load on demand rather than bloating
// the main chunk. Login and NotFound stay eager (small, and Login is the entry).
const Home = lazy(() => import("./pages/Home"));
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const AssessmentEditor = lazy(() => import("./pages/AssessmentEditor"));
const MetricsStandards = lazy(() => import("./pages/MetricsStandards"));
const Practitioners = lazy(() => import("./pages/Practitioners"));

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <DashboardLayout>
          <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/patient/:id" component={PatientDetail} />
              <Route path="/assessment/:id" component={AssessmentEditor} />
              <Route path="/assessment/:id/:tab" component={AssessmentEditor} />
              <Route path="/metrics" component={MetricsStandards} />
              <Route path="/practitioners" component={Practitioners} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

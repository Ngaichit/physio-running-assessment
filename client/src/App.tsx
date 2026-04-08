import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import PatientDetail from "./pages/PatientDetail";
import AssessmentEditor from "./pages/AssessmentEditor";
import MetricsStandards from "./pages/MetricsStandards";
import Practitioners from "./pages/Practitioners";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <DashboardLayout>
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

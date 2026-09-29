
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { ThemeProvider } from "./app/ThemeContext.tsx";
  import { PortaoAcesso } from "./app/components/TelaLogin.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <PortaoAcesso>
        <App />
      </PortaoAcesso>
    </ThemeProvider>,
  );

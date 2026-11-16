import { createRouter } from "@solidjs/router";
import { render } from "@solidjs/web";
import { Loading, lazy } from "solid-js";
import { FailureBoundary, Layout, NotFound, RequireUser } from "./Layout.tsx";
import "./index.css";

const Router = createRouter({
  routes: [
    { path: "/login", component: lazy(() => import("./pages/Login.tsx")) },
    { path: "/:id", component: lazy(() => import("./pages/Transfer.tsx")) },
    {
      path: "/",
      component: RequireUser,
      children: [
        { path: "/", component: lazy(() => import("./pages/Send.tsx")) },
        { path: "/transfers", component: lazy(() => import("./pages/Transfers.tsx")) },
        { path: "/admin", component: lazy(() => import("./pages/Admin.tsx")) },
      ],
    },
    { path: "*404", component: NotFound },
  ],
});

render(
  () => (
    <Router>
      {(props) => (
        <FailureBoundary>
          <Loading>
            <Layout>{props.children}</Layout>
          </Loading>
        </FailureBoundary>
      )}
    </Router>
  ),
  document.getElementById("app") as HTMLElement,
);

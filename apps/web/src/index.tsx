import { createRouter } from "@solidjs/router";
import { render } from "@solidjs/web";
import { Loading, lazy } from "solid-js";
import { Layout, NotFound, RequireUser } from "./Layout.tsx";
import "./index.css";

export const Router = createRouter({
  routes: [
    { path: "/login", component: lazy(() => import("./pages/Login.tsx")) },
    {
      path: "/",
      component: RequireUser,
      children: [{ path: "/", component: lazy(() => import("./pages/Send.tsx")) }],
    },
    { path: "*404", component: NotFound },
  ],
});
export const { paths } = Router;

render(
  () => (
    <Router>
      {(props) => (
        <Loading>
          <Layout>{props.children}</Layout>
        </Loading>
      )}
    </Router>
  ),
  document.getElementById("app") as HTMLElement,
);

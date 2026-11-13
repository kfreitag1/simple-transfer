import { createRouter } from "@solidjs/router";
import { render } from "@solidjs/web";
import { Loading, lazy } from "solid-js";
import "./index.css";

export const Router = createRouter({
  routes: [{ path: "/", component: lazy(() => import("./pages/Send.tsx")) }],
});
export const { paths } = Router;

render(
  () => <Router>{(props) => <Loading>{props.children}</Loading>}</Router>,
  document.getElementById("app") as HTMLElement,
);

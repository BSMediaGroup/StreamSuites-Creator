import { onRequest as __auth___path___js_onRequest } from "C:\\NEPTUNE LOCAL\\GIT\\StreamSuites-Creator\\functions\\auth\\[[path]].js"
import { onRequest as __oauth___path___js_onRequest } from "C:\\NEPTUNE LOCAL\\GIT\\StreamSuites-Creator\\functions\\oauth\\[[path]].js"
import { onRequest as ____path___js_onRequest } from "C:\\NEPTUNE LOCAL\\GIT\\StreamSuites-Creator\\functions\\[[path]].js"

export const routes = [
    {
      routePath: "/auth/:path*",
      mountPath: "/auth",
      method: "",
      middlewares: [],
      modules: [__auth___path___js_onRequest],
    },
  {
      routePath: "/oauth/:path*",
      mountPath: "/oauth",
      method: "",
      middlewares: [],
      modules: [__oauth___path___js_onRequest],
    },
  {
      routePath: "/:path*",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [____path___js_onRequest],
    },
  ]
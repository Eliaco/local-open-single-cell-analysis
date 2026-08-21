import { createRouter, createWebHistory } from "vue-router";

import HomeLayout from "../components/layouts/HomeLayout.vue";
import HomePageView from "../components/views/HomePageView.vue";
import RunPageView from "../components/views/RunPageView.vue";
import ViewPageView from "../components/views/ViewPageView.vue";

const routes = [
  {
    path: "/",
    component: HomeLayout,
    children: [
      {
        path: "/",
        name: "home",
        component: HomePageView,
      },
      {
        path: "/run",
        name: "run",
        component: RunPageView,
      },
      {
        path: "/view",
        name: "view",
        component: ViewPageView,
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

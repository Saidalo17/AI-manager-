import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taskly — AI Task Manager",
    short_name: "Taskly",
    description: "Матрица Эйзенхауэра с ИИ-разбором задач, голосом и фото",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0e0c1d",
    theme_color: "#5b5bf0",
    lang: "ru",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

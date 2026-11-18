import "./site";
import "../styles/guide.css";

/** The list of steps marks the one being read. */
function followSteps() {
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".toc ol a")) {
    links.set(link.hash.slice(1), link);
  }
  const steps = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((step): step is HTMLElement => step !== null);
  if (!steps.length || !("IntersectionObserver" in window)) return;

  const visible = new Set<string>();
  const mark = () => {
    const current = steps.find((step) => visible.has(step.id));
    for (const [id, link] of links) {
      if (id === current?.id) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    }
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      mark();
    },
    { rootMargin: "-30% 0px -55% 0px" },
  );
  for (const step of steps) observer.observe(step);
}

followSteps();

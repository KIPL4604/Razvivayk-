import { intro, stages as variables } from "./course-content.mjs?v=4";
import { foundations } from "./chapters-foundations.mjs?v=1";
import { coreChapters } from "./chapters-core.mjs?v=1";
import { appliedChapters } from "./chapters-applied.mjs?v=1";

const sections = [
  { id: "variables", title: "Переменные", stages: variables },
  ...foundations, ...coreChapters, ...appliedChapters,
];

export const stages = sections.flatMap(section => section.stages);
export const chapters = sections.reduce((all, section) => {
  const first = all.at(-1)?.end ?? 0;
  return [...all, { ...section, first, end: first + section.stages.length }];
}, []);
export { intro };

export const sectionAt = step => chapters.find(section => step < section.end) ?? chapters.at(-1);

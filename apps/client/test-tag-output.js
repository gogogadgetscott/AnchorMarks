import { Tag } from "./src/components/Tag.ts";

const result = Tag("test-tag", {
  color: "#ff0000",
  data: { action: "toggle-filter-tag", tag: "test-tag" },
});

console.log(result);

import * as s from "simple-icons";
const keys = ["siShell", "siGnubash", "siTypescript", "siReact", "siPython", "siJavascript", "siJson", "siCss", "siHtml5", "siYaml", "siMysql", "siMarkdown", "siDocker", "siGit", "siMysql", "siPrisma", "siVite", "siNextdotjs"];
for (const key of keys) {
  console.log(key, typeof s[key], s[key] ? s[key].title : "");
}

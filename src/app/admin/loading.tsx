// The manager's table skeleton. Without it, a row click showed nothing until
// the detail page's backend reads came back — seconds on the dev API, which
// read as a link that does not work.
export { default } from "../manager/loading";

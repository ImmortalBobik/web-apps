// {{TITLE}} — replace this starter logic with the real app.
const countEl = document.querySelector("#count");
let count = 0;

document.querySelector("#inc").addEventListener("click", () => {
  count += 1;
  countEl.textContent = count;
});
